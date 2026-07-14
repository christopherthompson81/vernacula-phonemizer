/**
 * German morphological decomposition — the layer that makes boundary-sensitive phonology possible. A word is
 * split into PREFIX* · STEM (+link · STEM)* · SUFFIX*, and the boundaries are marked so the g2p can apply:
 *   - element-initial rules at each boundary (sp/st → ʃp/ʃt, s → z before a vowel, glottal stop),
 *   - morpheme-final devoicing (Fried·hof → …t·h…),
 *   - blocked cross-boundary assimilation (Waren·korb keeps n·k, not ŋk),
 *   - the stress domain (primary stress on a separable prefix or the first stem).
 *
 * Two closed, curated lists (prefixes/suffixes — small by nature) drive the reliable part; an open content-stem
 * lexicon (stems.txt, from kaikki ∩ frequency) drives conservative, frequency-safe compound splitting. This is
 * the same shape as hunspell/espeak affix flags — the lists here ARE the affix table; a future lexicon could
 * instead carry per-word flags. See docs/de_native_bringup_investigation.md.
 */

import { MANIFEST } from "./manifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";

export const BOUNDARY = "·"; // inserted between morphemes; the g2p treats the next letter as element-initial

// Inseparable (unstressed) prefixes — kept as spelling; the g2p reduces their vowel and treats the stem as
// element-initial. Ordered longest-first for greedy stripping.
export const PREFIX_UNSTRESSED = MANIFEST.morphology.prefixUnstressed;
// Separable prefixes — these carry the PRIMARY stress and are their own phonological word.
export const PREFIX_STRESSED = MANIFEST.morphology.prefixStressed;

// Derivational + inflectional suffixes (longest-first). Kept as spelling; their phonology is regular in the g2p
// (-ig → ɪç, -lich → lɪç, -ung → ʊŋ, -chen → çən, weak -en/-er/-e → schwa/ɐ).
export const SUFFIXES = MANIFEST.morphology.suffixes;

// Morphological lexicon: word → flags. k = compound constituent; N = noun; s = takes Fugen-s. The flags drive
// decomposition (like hunspell/espeak affix flags), so it's precise rather than heuristic.
let LEXICON: Map<string, string> | undefined;
function lexicon(): Map<string, string> {
    if (LEXICON === undefined)
        LEXICON = loadTsvMap(import.meta.url, "lexicon.tsv", undefined, {
            optional: true,
        });
    return LEXICON;
}
const flags = (w: string): string => lexicon().get(w) ?? "";
const isWord = (w: string): boolean => lexicon().has(w); // a known content word
const isConstituent = (w: string): boolean =>
    w.length >= 3 && flags(w).includes("k"); // valid compound part
// A remainder "resolves" if it is itself a known word/constituent or fully splits — the splittability test that
// gates a boundary-creating strip (so we don't peel -lich off a non-word).
const resolves = (w: string): boolean =>
    isWord(w) || isConstituent(w) || splitCompound(w) !== null;
// Suffixes that begin with a vowel resyllabify onto the stem (no boundary) — loose to strip; consonant-initial
// suffixes create a devoicing boundary, so their stem must resolve.
const VOWEL_INITIAL_SUFFIX = new Set(MANIFEST.morphology.vowelInitialSuffixes);
// be-/ge-/er- also occur root-initially (beide, geht, Erde); only strip them if the remainder is a real word.
const PREFIX_AMBIGUOUS = new Set(MANIFEST.morphology.ambiguousPrefixes);

// Fugen-elemente in preference order; a stem with the s flag takes -s- (Zeitungs-, Arbeits-).
const LINKS_DEFAULT = MANIFEST.morphology.linkingElements;

/** Split a run into flagged compound constituents (longest-leading, ≤3 parts). null = not a compound. The
 *  leading element is ≥4 letters (so ham·burg doesn't split and wrongly lengthen the a); trailing ≥3 (hof). */
function splitCompound(w: string, depth = 0): string[] | null {
    if (depth > 2) return null;
    for (let i = w.length - 3; i >= 4; i--) {
        const head = w.slice(0, i);
        if (!isConstituent(head)) continue;
        const links = flags(head).includes("s")
            ? ["s", ...LINKS_DEFAULT]
            : LINKS_DEFAULT; // prefer -s- if flagged
        for (const lk of links) {
            if (!w.slice(i).startsWith(lk)) continue;
            const rest = w.slice(i + lk.length);
            if (rest.length < 3) continue;
            if (isConstituent(rest)) return [head + lk, rest]; // linking element stays with the head
            const tail = splitCompound(rest, depth + 1);
            if (tail) return [head + lk, ...tail];
        }
    }
    return null;
}

// Fixed IPA for the closed affixes (this list IS the affix "flag table") — data in german.jsonc.
export const PREFIX_IPA = MANIFEST.morphology.prefixIpa;
export const SUFFIX_IPA = MANIFEST.morphology.suffixIpa;

export type Kind = "prefix" | "stem" | "suffix";
export interface Decomp {
    parts: string[]; // morphemes in order (prefixes, stems, suffixes)
    kinds: Kind[]; // kind of each part
    stressPart: number; // index of the part carrying primary stress
}

/** Decompose a word into ordered morphemes with a stress hint. Only splits when confident (known affixes,
 *  content stems); otherwise returns the whole word as a single stem. */
export function decompose(word: string): Decomp {
    const w = word.toLowerCase();
    const prefixes: string[] = [];
    let rest = w;
    // Strip unstressed then a stressed prefix (at most a couple), keeping ≥4 letters of stem behind.
    for (let round = 0; round < 3; round++) {
        let stripped = false;
        for (const p of PREFIX_UNSTRESSED) {
            if (!rest.startsWith(p) || rest.length - p.length < 4) continue;
            const r = rest.slice(p.length);
            // ambiguous be-/ge-/er- must leave a real word (beiden ✗, gemacht ✓); others just need a plausible onset.
            const ok = PREFIX_AMBIGUOUS.has(p)
                ? isWord(r) || splitCompound(r) !== null
                : isStemish(r);
            if (ok) {
                prefixes.push(p);
                rest = r;
                stripped = true;
                break;
            }
        }
        if (!stripped) break;
    }
    let sepPrefix = "";
    for (const p of PREFIX_STRESSED) {
        if (
            rest.startsWith(p) &&
            rest.length - p.length >= 4 &&
            isStemish(rest.slice(p.length))
        ) {
            sepPrefix = p;
            rest = rest.slice(p.length);
            break;
        }
    }
    // Strip trailing derivational suffixes (leave a ≥3-letter stem).
    const suffixes: string[] = [];
    for (let round = 0; round < 2; round++) {
        let stripped = false;
        for (const s of SUFFIXES) {
            if (!rest.endsWith(s) || rest.length - s.length < 3) continue;
            const stem = rest.slice(0, rest.length - s.length);
            // Don't strip a boundary INSIDE the ⟨sch⟩ digraph: a "…schen" word is the far-commoner VERB rausch·en
            // (sch = one /ʃ/), not the raus·chen diminutive. The rare s-final-noun diminutives (Häuschen) already
            // don't reach here (häus isn't a lexeme). This is the split-ranking principle in miniature: reject a
            // boundary that shatters a digraph. (Also guards ⟨ch⟩-initial suffixes generally.)
            if (s.startsWith("ch") && stem.endsWith("s")) continue;
            // vowel-initial suffix resyllabifies (loose); consonant-initial one creates a boundary → stem must resolve.
            const ok = VOWEL_INITIAL_SUFFIX.has(s)
                ? isStemish(stem)
                : resolves(stem);
            if (ok) {
                suffixes.unshift(s);
                rest = stem;
                stripped = true;
                break;
            }
        }
        if (!stripped) break;
    }
    // Compound-split whatever remains.
    let stemParts = splitCompound(rest) ?? [rest];
    // If a suffix strip left an unsplittable single stem, retry the compound split on the UN-stripped form — the
    // suffix belongs to the last constituent, not the whole word (waldsterben: -en left "waldsterb" which can't
    // split, but wald·sterben can; pickelhaube → pickel·haube). Only fires when the stem otherwise wouldn't split.
    if (stemParts.length === 1 && suffixes.length) {
        const whole = rest + suffixes.join("");
        const cs = splitCompound(whole);
        if (cs && cs.length >= 2) {
            stemParts = cs;
            suffixes.length = 0;
        }
    }

    const parts = [
        ...prefixes,
        ...(sepPrefix ? [sepPrefix] : []),
        ...stemParts,
        ...suffixes,
    ];
    const kinds: Kind[] = [
        ...prefixes.map(() => "prefix" as Kind),
        ...(sepPrefix ? ["prefix" as Kind] : []),
        ...stemParts.map(() => "stem" as Kind),
        ...suffixes.map(() => "suffix" as Kind),
    ];
    // Primary stress: the separable prefix, else the first stem — both sit at index prefixes.length.
    return { parts, kinds, stressPart: prefixes.length };
}

const VALID_ONSET2 = new Set(MANIFEST.morphology.validOnsets);

/** Loose gate: a stripped stem must have a vowel and start with a valid German onset (so a prefix isn't peeled
 *  off a non-word — be+rlin, where "rl" is not an onset). */
function isStemish(w: string): boolean {
    if (!/[aeiouäöüy]/.test(w)) return false;
    const a = w[0] ?? "",
        b = w[1] ?? "";
    if ("aeiouäöüy".includes(a)) return true; // vowel-initial
    if ("aeiouäöüy".includes(b) || b === "") return true; // single consonant onset
    return VALID_ONSET2.has(a + b) || VALID_ONSET2.has(w.slice(0, 3)); // valid cluster (st, schw…)
}

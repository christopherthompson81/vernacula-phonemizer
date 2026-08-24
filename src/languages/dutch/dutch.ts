/**
 * Dutch (nl) phonemizer — Northern Standard Dutch, canonical IPA. Rule-based g2p (g2p.ts)
 * with Germanic initial stress (the first full syllable, or the first after an unstressed prefix be-/ge-/ver-/
 * ont-/her-/te-). text() tokenizes words / numbers / punctuation.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import type { Kind } from "../../core/germanicMorphology.ts";
import { toSegments, type Seg } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { decompose, isLexicalWord } from "./morphology.ts";
import { MANIFEST } from "./manifest.ts";
import { normalizeDutch, normalizeDutchInitialisms } from "./normalize.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";

// Unstressed prefixes that shift stress off the first syllable (verkópen, gelóven, begín, ontslág, herhálen),
// and the subset whose vowel additionally REDUCES to schwa (ge-/be-/ver-/te- → ɣə/bə/vər/tə; ont-/her- shift
// stress but KEEP their full vowel, ɔnt-/hɛr-).
//
// ⚠ BOTH ARE BUILT FROM THE MANIFEST, and the first was a duplicate of `morphology.prefixUnstressed` that had
// been sitting beside it in dutch.jsonc all along. Alternation order is free here because no member is a
// prefix of another — if one ever is, this must sort longest-first.
const alt = (xs: readonly string[]): RegExp => new RegExp(`^(${xs.join("|")})`, "u");
const UNSTRESSED_PREFIX = alt(MANIFEST.morphology.prefixUnstressed);
const SCHWA_PREFIX = alt(MANIFEST.morphology.prefixSchwa);

// High-frequency function words / clitics whose vowel is reduced to schwa — the g2p's first-syllable rule
// would give them a full vowel (de → deː). Now data: see dutch.jsonc, which also records why the
// numeral/article "een" is deliberately absent.
const FUNCTION_WORDS: Record<string, string> = MANIFEST.functionWords;

/** Place primary stress and reduce an unstressed prefix's vowel. Returns the stressed-nucleus seg index. The
 *  prefix is treated as unstressed ONLY when a later nucleus exists AND it isn't a schwa — this distinguishes a
 *  real prefix (ge·maakt, nucleus1 = aː → shift + reduce ge→ɣə) from a ⟨ge⟩-root (geven, nucleus1 = ə → no shift,
 *  ɣˈeːvən, no stressed schwa). When the shift fires, a ge-/be-/ver-/te- prefix vowel (segs[nuclei0]) also
 *  reduces to ə (ont-/her- keep their full vowel). Offglides (vowel:false) are skipped — only true nuclei count. */
function placeStress(segs: Seg[], word: string): number {
    const nuclei = segs.map((s, k) => (s.vowel ? k : -1)).filter((k) => k >= 0);
    if (nuclei.length === 0) return -1;
    const lower = word.toLowerCase();
    if (nuclei.length > 1 && UNSTRESSED_PREFIX.test(lower) && segs[nuclei[1]!]!.ph !== "ə") {
        if (SCHWA_PREFIX.test(lower)) segs[nuclei[0]!]!.ph = "ə"; // ge-/be-/ver-/te- vowel → schwa
        return nuclei[1]!;
    }
    // First non-schwa nucleus (a schwa-initial root like the reduced prefix be- pushes stress right).
    return nuclei.find((k) => segs[k]!.ph !== "ə") ?? nuclei[0]!;
}

/** Phonemize a single stress group (a stem plus its own prefixes/suffixes) — the existing g2p handles its internal
 *  prefix reduction (ge-/be-/ver-/te-) and suffix schwa (-ig/-lijk/-isch). */
function phonemizeChunk(word: string): string {
    const segs = toSegments(word);
    if (segs.length === 0) return "";
    const stress = placeStress(segs, word);
    let out = "";
    for (let k = 0; k < segs.length; k++) {
        if (k === stress) out += "ˈ";
        out += segs[k]!.ph;
    }
    return out;
}

/** Merge a decomposition into stem-headed STRESS GROUPS: a prefix attaches to the following element, a suffix to
 *  the preceding, and a second stem starts a new group. So only COMPOUND (stem·stem) boundaries survive — the g2p
 *  already reduces each group's own prefix/suffix internally, and an over-stripped affix simply rejoins its stem. */
function stressGroups(parts: string[], kinds: Kind[]): string[] {
    const groups: string[] = [];
    let cur = "";
    let hasStem = false;
    for (let i = 0; i < parts.length; i++) {
        if (kinds[i] === "stem" && hasStem) { groups.push(cur); cur = ""; hasStem = false; }
        cur += parts[i];
        if (kinds[i] === "stem") hasStem = true;
    }
    if (cur) groups.push(cur);
    return groups;
}

/** Phonemize a single Dutch word to canonical IPA (with a stress mark). A compound is split at its stem·stem
 *  boundaries and each element phonemized independently, so each keeps its own stressed vowel and devoices at its
 *  own boundary (stad·huis → ˈstɑtˈɦœys); a non-compound (or a prefix/suffix-only word) takes the direct path. */
export function phonemizeWord(word: string): string {
    const reduced = FUNCTION_WORDS[word.toLowerCase()];
    if (reduced !== undefined) return reduced;
    const w = word.toLowerCase();
    // A word that is itself a dictionary entry is monomorphemic-or-lexicalised → phonemize whole (skip splitting).
    // Guards minister→mini·ster, spelling→spel·ling, drinken→drin·ken (no constituent flags to reject those tails).
    if (isLexicalWord(w)) return phonemizeChunk(word);
    const d = decompose(w);
    if (d.parts.length > 1) {
        const groups = stressGroups(d.parts, d.kinds);
        if (groups.length > 1) return joinChunks(groups.map(phonemizeChunk));
    }
    return phonemizeChunk(word);
}

// IPA consonant symbols a Dutch chunk can end/start with (for seam degemination). Vowels/offglides excluded.
const CONS_IPA = new Set(MANIFEST.consonantPhones);

/** Join compound chunks, DEGEMINATING at each seam: Dutch collapses a doubled consonant across a compound boundary
 *  (voedings+stof → vudɪŋstɔf, knoop+punt → knoːpʏnt, gras+spriet → ɣraspriːt). The next chunk's leading stress mark
 *  is skipped when comparing the seam consonant. */
function joinChunks(chunks: string[]): string {
    let out = chunks[0] ?? "";
    for (let i = 1; i < chunks.length; i++) {
        const g = chunks[i]!;
        const onset = g.startsWith("ˈ") ? g[1] : g[0]; // first phoneme (skip a leading stress mark)
        const coda = out[out.length - 1];
        if (coda && onset === coda && CONS_IPA.has(coda)) out = out.slice(0, -1); // drop the duplicated coda
        out += g;
    }
    return out;
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// A word (Latin letters incl. Dutch diacritics) / number / punctuation token. An optional LEADING apostrophe
// captures the reduced clitics 't 'n 'k 'm 's (informal Dutch); medial apostrophes handle zo'n, auto's.
//
// ⚠ DUTCH GROUPS THOUSANDS WITH A PERIOD AND TAKES A COMMA DECIMAL, so a bare `(\d+)` number group lets BOTH
// separators fall through to clausePunctuation: "400.000" reads *vierhonderd . nul* — a phrase break plus a
// lost magnitude — and "6,5" reads *zes , vijf*. Clocks are claimed by normalize.ts first, so a period reaching
// here is grouping and a comma is the decimal point.
const TOKEN = /(['’]?[a-zà-ÿ]+(?:['’][a-zà-ÿ]+)*)|(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?)|([.!?…,;:])/giu;

// Dutch measure and currency nouns are INVARIANT after a numeral ("vijf euro", "83 kilometer", "27 miljoen
// pond"), so each entry is a single form and no count agreement is needed.
// ⚠ `g` IS DELIBERATELY NOT A UNIT: the Wi-Fi standards are written "802.11a/b/g", and "11g" is not 11 grams.
const SYMBOLS = makeSymbolNormalizer({
    // ⚠ `multiply` IS STANDARD MATHEMATICAL REGISTER, not a corpus attestation: a corpus sweep for the operator
    // returns homographs of PREPOSITIONS in every language tried. One word, so `by` defaults to it — Dutch does
    // not split dimension from product.
    multiply: { times: "keer" },
    percent: ["procent"],
    currency: { "€": ["euro"], $: ["dollar"], "£": ["pond"], "¥": ["yen"] },
    units: {
        km: ["kilometer"], cm: ["centimeter"], mm: ["millimeter"], m: ["meter"],
        kg: ["kilogram"], mg: ["milligram"], ha: ["hectare"], mi: ["mijl"],
        mph: ["mijl per uur"],
    },
    // ⚠ Denominators ONLY. `s` as a standalone unit makes `Il-76s` read *zesenzeventig seconde*.
    rateDenominators: { u: "uur", h: "uur", s: "seconde" },
    unitPer: "per",
    // Dutch puts the measure word BEFORE the unit, spaced, and measure nouns stay singular after a numeral.
    exponentWords: { squared: ["vierkante"], cubed: ["kubieke"], position: "before" },
    magnitudes: ["miljoen", "miljard", "biljoen"],
});

class DutchPhonemizer implements Phonemizer {
    text(input: string): string {
        // ⚠ THE ORDER IS FORCED: Dutch rewrites (era/abbreviations, dotted capital runs, ORDINALS, clock,
        // units, signs) → INITIALISMS → the shared symbol tier. The initialism pass must follow the
        // abbreviation rewrites, or `V.S.` never becomes the caps run it spells out; and the symbol tier must
        // follow the local unit rules, which own the ratio and squared forms it cannot express.
        const normalized = SYMBOLS(normalizeDutchInitialisms(normalizeDutch(input)));
        return assembleClauses(normalized, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) {
                // The PERIOD is thousands grouping and the COMMA is the decimal point (see TOKEN).
                const [intPart, frac] = m[2].replace(/\./gu, "").split(",");
                for (const wd of numberToWords(Number(intPart)).split(" ")) sink.emit(phonemizeWord(wd));
                if (frac !== undefined) {
                    sink.emit(phonemizeWord(MANIFEST.numbers.decimalWord));
                    for (const d of frac)
                        for (const wd of numberToWords(Number(d)).split(" ")) sink.emit(phonemizeWord(wd));
                }
            } else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Dutch phonemizer. */
export function createDutch(): Phonemizer {
    return new DutchPhonemizer();
}

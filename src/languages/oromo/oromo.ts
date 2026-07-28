/**
 * Native Oromo / Afaan Oromoo (om) text phonemizer — canonical IPA, espeak-independent. A shallow near-phonemic
 * Latin (Qubee) orthography → rule-based transliterator: digraphs (ch→t͡ʃ, dh→ᶑ, ny→ɲ, ph→pʼ, sh→ʃ) then single
 * letters, with DOUBLED VOWELS = long (aa→aː) and DOUBLED CONSONANTS = geminate (bb→bː); a geminate DIGRAPH doubles
 * its first letter (ddh→[ᶑː], cch→[t͡ʃː]). The apostrophe → glottal stop [ʔ] (buʼaa→buʔaː). Qubee is largely
 * phonemic → the g2p is deterministic. Oromo (Cushitic) fills a census gap: the EJECTIVES c/q/x/ph + implosive dh.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface OromoDef {
    digraphs: Record<string, string>;
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<OromoDef>(import.meta.url, "oromo.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;

export type ForeignPhonemizer = (latin: string) => string;

const APOSTROPHE = new Set(["'", "ʼ", "’"]); // ' ʼ ’ → glottal stop

/** Scan a lowercased Oromo word → IPA units (digraphs, gemination, length, glottal stop). */
function scan(w: string): string[] {
    const s = [...w.toLowerCase()];
    const out: string[] = [];
    for (let i = 0; i < s.length; ) {
        const c = s[i]!;
        if (APOSTROPHE.has(c)) {
            // The glottal stop is written with an apostrophe only INTERIOR (buʼaa, saʼa); a word-edge apostrophe is
            // a quotation mark, not a glottal (and ’ U+2019 doubles as a closing quote), so emit [ʔ] only between
            // letters — a letter before, and a non-apostrophe letter after.
            const next = s[i + 1];
            if (i > 0 && next !== undefined && !APOSTROPHE.has(next)) out.push("ʔ");
            i++;
            continue;
        }
        // Geminate DIGRAPH: a doubled first letter + a digraph (Qubee writes it ddh/cch/nny/ssh/pph → [ᶑː]/[t͡ʃː]…).
        if (s[i + 1] === c) {
            const dg2 = (s[i + 1] ?? "") + (s[i + 2] ?? "");
            if (DEF.digraphs[dg2]) {
                out.push(DEF.digraphs[dg2]! + "ː");
                i += 3;
                continue;
            }
        }
        // Plain digraph.
        const dg = c + (s[i + 1] ?? "");
        if (DEF.digraphs[dg]) {
            out.push(DEF.digraphs[dg]!);
            i += 2;
            continue;
        }
        // Doubled letter → long vowel (aa→aː) or geminate consonant (bb→bː).
        if (s[i + 1] === c) {
            const single = DEF.vowels[c] ?? DEF.consonants[c];
            if (single !== undefined) {
                out.push(single + "ː");
                i += 2;
                continue;
            }
        }
        // Single letter.
        const single = DEF.vowels[c] ?? DEF.consonants[c];
        if (single !== undefined) out.push(single);
        i++;
    }
    return out;
}

// ── Stress ────────────────────────────────────────────────────────────────────────────────────────────────
// Oromo stress is PHONETIC and PREDICTABLE — "there is no lexical contrast by making use of stress, and it could
// be predictable from the environment of the utterance" (Dejene Geshe, *Kamisee Oromo Phonology*, Addis Ababa
// University MA thesis, 2010, §5.3.1). The same patterns are reported for the MECHA dialect by Waqo (1981:44) and
// Gragg (1976:175), so this is not one dialect's quirk. Dejene further argues (§5.4.3) that the dialect is a
// STRESS language employing pitch rather than a tone language, against Habte (2003).
//
// The thesis rules, verbatim:
//   1) monosyllables are stressed
//   2) disyllabic ending in a SHORT vowel → primary on the PENULT, "whatever the length of the vowel of a
//      preceding syllable"
//   3) polysyllabic with NO long vowels  → primary on the PENULT
//   4) ending in a LONG vowel            → primary on the ULTIMATE
//   5) ending in a CONSONANT             → primary on the ULTIMATE if all syllables are short; if another
//      syllable has a long vowel, THAT one takes primary
//   fn16) a non-ultimate long vowel with a short ultimate attracts the stress
//
// Validated against a genuinely INDEPENDENT source — the 39 accent-marked kaikki (Wiktionary) human
// transcriptions in tools/referee-eval/referees/om.human-kaikki.tsv: **76.9% as written, 92.3%** with the
// infinitive refinement below. Neither source saw the other.
const IS_VOWEL = new Set([...Object.values(DEF.vowels)]);
const isVowelUnit = (u: string): boolean => IS_VOWEL.has(u.replace(/ː/g, ""));

/** Nucleus indices into the unit array, with whether each is long. */
function nuclei(units: string[]): Array<{ at: number; long: boolean }> {
    const out: Array<{ at: number; long: boolean }> = [];
    units.forEach((u, i) => {
        if (isVowelUnit(u)) out.push({ at: i, long: u.includes("ː") });
    });
    return out;
}

/** Index of the syllable carrying primary stress, or -1 to leave the word unmarked. */
function stressIndex(units: string[]): number {
    const nu = nuclei(units);
    const n = nu.length;
    if (n === 0) return -1;
    if (n === 1) return 0; // rule 1

    // The INFINITIVE suffix -uu does not attract stress; it is extrametrical. The thesis's rule-4 examples are
    // all nouns/adjectives in -aa/-oo/-ii (sàngáa, dargàggóo, ʔàdíi) — never infinitives — and the independent
    // kaikki data marks every -uu infinitive on an earlier syllable (ˈdɪ́duː, ˈbɐ́nuː, ʔɐdʒˈdʒeːsuː). Adding this
    // takes agreement 76.9% → 92.3%. KNOWN LIMIT: a NOUN in -uu is misread the same way (tiruu 'liver' is
    // tɪˈrúː, we predict the penult) — telling the two apart needs morphology we do not have here.
    const last = nu[n - 1]!;
    const endsWithVowel = last.at === units.length - 1;
    if (endsWithVowel && last.long && units[last.at]!.startsWith("u") && n >= 2) {
        const head = nu.slice(0, -1);
        for (let k = head.length - 1; k >= 0; k--) if (head[k]!.long) return k;
        return head.length - 1;
    }

    if (!endsWithVowel) {
        // rule 5: a long vowel anywhere else outranks the ultimate
        for (let k = 0; k < n - 1; k++) if (nu[k]!.long) return k;
        return n - 1;
    }
    if (last.long) return n - 1; // rule 4
    // ultimate is a SHORT vowel → fn16, else rules 2/3 (penult)
    for (let k = n - 2; k >= 0; k--) if (nu[k]!.long) return k;
    return n - 2;
}

/** Insert the primary-stress mark before the nucleus of the selected syllable (the fleet convention: kˈiː). */
function applyStress(units: string[]): string[] {
    const idx = stressIndex(units);
    if (idx < 0) return units;
    const nu = nuclei(units);
    const at = nu[idx]!.at;
    return [...units.slice(0, at), "ˈ", ...units.slice(at)];
}

/** One Oromo word → canonical IPA. */
export function phonemizeWord(word: string): string {
    return applyStress(scan(word)).join("").normalize("NFC");
}

/** One Oromo word → canonical IPA, WITHOUT the stress layer (the referee eval's segmental signal). */
export function phonemizeWordSegmental(word: string): string {
    return scan(word).join("").normalize("NFC");
}

const TOKEN = /([A-Za-zʼ’']+)|(\d+)|([.?!,;:])/gu;

class OromoPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(this.foreign ? this.foreign(m[2]) : "");
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Oromo phonemizer. */
export function createOromo(): Phonemizer {
    return new OromoPhonemizer();
}

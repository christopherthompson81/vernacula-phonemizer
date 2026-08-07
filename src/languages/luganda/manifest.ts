/**
 * Loads the Luganda data manifest (luganda.jsonc) once at module init and exposes it typed. Holds the
 * context-free hand-authored DATA: the orthography→IPA grapheme table (prenasalised units, vowel-length digraphs,
 * ⟨ng'⟩, labialisation) + clause punctuation. The gemination + vowel-lengthening ALGORITHM stays in code.
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface LugandaManifest {
    language: string;
    name: string;
    script: readonly string[];
    graphemes: Record<string, string>;
    /** The five vowel letters — a doubled one is length, not the geminate a doubled consonant makes. */
    vowelLetters: readonly string[];
    /** The obstruent letters a preceding ⟨n m⟩ prenasalises into one onset unit. */
    prenasalisable: readonly string[];
    clausePunctuation: Record<string, string>;
    numbers: LugandaNumbers;
}

/** The Luganda cardinal number words (see luganda.jsonc "numbers"; the compositor is numbers.ts). Every
 *  magnitude carries its OWN multiplier concord series — amakumi takes a-, bikumi takes bi-, obukadde takes bu- —
 *  so one shared "units" list must never be reused across multiplier slots. */
export interface LugandaNumbers {
    /** zero. */
    zero: string;
    /** the citation/counting forms 1–9 at indices 1–9; index 0 unused. */
    units: string[];
    /** ten (kkumi). */
    ten: string;
    /** the round tens, indices 1–9 (20–50 multiplicative amakumi + a-; 60–90 are single nouns). */
    tens: string[];
    /** exactly 100 (kikumi). */
    hundredOne: string;
    /** the class-8 plural of "hundred" (bikumi). */
    hundreds: string;
    /** the bi- multiplier after `hundreds`, indices 2–9. */
    hundredsMult: string[];
    /** exactly 1 000 (lukumi). */
    thousandOne: string;
    /** the plural of "thousand" (nkumi), followed by the multiplier rendered recursively. */
    thousands: string;
    /** exactly 10⁶ (kakadde kamu). */
    millionOne: string;
    /** the class-14 plural of "million" (obukadde). */
    millions: string;
    /** exactly 10⁹ (akawumbi kamu). */
    billionOne: string;
    /** the class-14 plural of "billion" (obuwumbi). */
    billions: string;
    /** the class-14 bu- multiplier for obukadde/obuwumbi, indices 2–9. */
    buMult: string[];
    /** the teen connective (na). */
    andTeen: string;
    /** the teen connective elided before a vowel (n'). */
    andTeenElided: string;
    /** the connective between magnitude components (mu). */
    mu: string;
}

/** The consolidated hand-authored Luganda data tables (see luganda.jsonc). */
export const MANIFEST = loadManifest<LugandaManifest>(import.meta.url, "luganda.jsonc");

// Grapheme keys sorted LENGTH DESC so the greedy scan tries nng'/nny/ng'/ny, the Cw + prenasalised digraphs, and
// the vowel-length digraphs before singles.
export const GRAPHEME_KEYS = Object.keys(MANIFEST.graphemes).sort((a, b) => b.length - a.length);

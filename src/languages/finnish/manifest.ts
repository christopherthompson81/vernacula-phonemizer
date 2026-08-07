/**
 * Loads the Finnish data manifest (finnish.jsonc) once at module init and exposes it typed. Holds the context-free
 * hand-authored DATA: the orthography→IPA grapheme table (8 vowels, long-vowel + diphthong digraphs, ʋ/r/loan
 * consonants), the cardinal-number word stems, and clause punctuation. The gemination + ⟨ng⟩/⟨nk⟩ ALGORITHM stays in
 * code (finnish.ts).
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface FinnishManifest {
    language: string;
    name: string;
    script: readonly string[];
    graphemes: Record<string, string>;
    numbers: {
        zero: string;
        units: string[];
        ten: string;
        tensStem: string;
        teenSuffix: string;
        hundred: string;
        hundredStem: string;
        thousand: string;
        thousandStem: string;
        million: string;
        millionStem: string;
    };
    clausePunctuation: Record<string, string>;
}

/** The consolidated hand-authored Finnish data tables (see finnish.jsonc). */
export const MANIFEST = loadManifest<FinnishManifest>(import.meta.url, "finnish.jsonc");

// Grapheme keys sorted LENGTH DESC so the greedy scan tries the vowel digraphs (long vowels aa/ää…, diphthongs ai/uo…)
// before the singles.
export const GRAPHEME_KEYS = Object.keys(MANIFEST.graphemes).sort((a, b) => b.length - a.length);

/**
 * Loads the Afrikaans data manifest (afrikaans.jsonc) once at module init and exposes it typed. Holds the
 * hand-authored DATA tables (fixed graphemes/consonants, long/short bare-vowel maps, diacritic vowels, clause
 * punctuation). The open/closed vowel-length lookahead + final devoicing ALGORITHM lives in afrikaans.ts.
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface AfrikaansManifest {
    language: string;
    name: string;
    script: string;
    fixed: Record<string, string>;
    vowelsLong: Record<string, string>;
    vowelsShort: Record<string, string>;
    diacriticVowels: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: {
        units: string[];
        teens: string[];
        tens: string[];
        en: string;
        hundred: string;
        thousand: string;
        million: string;
    };
    morphology: {
        prefixUnstressed: string[];
        prefixStressed: string[];
        ambiguousPrefixes: string[];
        suffixes: string[];
        vowelInitialSuffixes: string[];
        linkingElements: string[];
        validOnsets: string[];
        stKeep: string[];
    };
}

export const MANIFEST = loadManifest<AfrikaansManifest>(import.meta.url, "afrikaans.jsonc");

/** Fixed grapheme keys sorted length-descending so the greedy scan tries trigraphs/digraphs before single letters. */
export const FIXED_KEYS = Object.keys(MANIFEST.fixed).sort((a, b) => b.length - a.length);

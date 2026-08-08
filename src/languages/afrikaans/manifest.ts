/**
 * Loads the Afrikaans data manifest (afrikaans.jsonc) once at module init and exposes it typed. Holds the
 * hand-authored DATA tables (fixed graphemes/consonants, long/short bare-vowel maps, diacritic vowels, clause
 * punctuation). The open/closed vowel-length lookahead + final devoicing ALGORITHM lives in afrikaans.ts.
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface AfrikaansManifest {
    language: string;
    name: string;
    script: readonly string[];
    fixed: Record<string, string>;
    vowelsLong: Record<string, string>;
    vowelsShort: Record<string, string>;
    diacriticVowels: Record<string, string>;
    /** The five bare vowels routed through the open/closed length rule. */
    bareVowels: readonly string[];
    /** Every letter that heads a nucleus — bounds the consonant run in that same lookahead. */
    vowelLetters: readonly string[];
    voicedFinal: Record<string, string>;
    unstressedReduction: Record<string, string>;
    cSoftBefore: readonly string[];
    stressFinalSuffixes: readonly string[];
    stressPenultSuffixes: readonly string[];
    /** Reduced IPA per unstressed prefix; the keys must equal `morphology.prefixUnstressed`. */
    prefixIpa: Record<string, string>;
    /** Ordinals 1–19; index 0 unused. Above 20 the ending is regular — see normalize.ts. */
    ordinalsBelow20: readonly string[];
    /** [regex SOURCE, replacement] — every pattern is dot-bound on purpose; see the manifest note. */
    multiDotAbbreviations: readonly (readonly [string, string])[];
    dottedAbbreviations: Record<string, string>;
    letterNames: Record<string, string>;
    wordAcronyms: readonly string[];
    acronymLetters: readonly string[];
    phonotactics: { legalOnsets: readonly string[]; legalCodas: readonly string[] };
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

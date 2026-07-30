/**
 * Loads the German data manifest (german.jsonc) once at module init and exposes it typed. The hand-authored
 * DATA tables (vowel length maps, final-devoicing pairs, exception word-lists, clause punctuation, the
 * morphology tables, number words) live in the JSONC; the ALGORITHMS that consume them stay in the sibling
 * modules (g2p.ts, german.ts, morphology.ts, numbers.ts).
 */

import { loadManifest } from "../../core/loadManifest.ts";

export interface GermanManifest {
    /** Acronyms read letter-by-letter; see german.jsonc. */
    acronymLetters: string[];
    vowelChars: string;
    vowels: {
        long: Record<string, string>;
        short: Record<string, string>;
        longOf: Record<string, string>;
        shortOf: Record<string, string>;
    };
    consonants: Record<string, string>;
    voicedFinal: Record<string, string>;
    shortMonosyllables: string[];
    longCh: string[];
    clausePunctuation: Record<string, string>;
    morphology: {
        prefixUnstressed: string[];
        prefixStressed: string[];
        suffixes: string[];
        vowelInitialSuffixes: string[];
        ambiguousPrefixes: string[];
        linkingElements: string[];
        validOnsets: string[];
        prefixIpa: Record<string, string>;
        suffixIpa: Record<string, string>;
        stKeepWords: string[];
    };
    numbers: {
        ones: string[];
        tens: string[];
        compoundOne: string;
        connector: string;
        hundred: string;
        thousand: string;
        million: { sg: string; pl: string };
    };
}

/** The consolidated hand-authored German data tables (see german.jsonc). */
export const MANIFEST = loadManifest<GermanManifest>(import.meta.url, "german.jsonc");

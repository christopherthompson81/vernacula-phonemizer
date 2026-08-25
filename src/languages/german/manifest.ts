/**
 * Loads the German data manifest (german.jsonc) once at module init and exposes it typed. The hand-authored
 * DATA tables (vowel length maps, final-devoicing pairs, exception word-lists, clause punctuation, the
 * morphology tables, number words) live in the JSONC; the ALGORITHMS that consume them stay in the sibling
 * modules (g2p.ts, german.ts, morphology.ts, numbers.ts).
 */

import { loadManifest } from "../../core/loadManifest.ts";
import type { CountForms } from "../../core/normalizeSymbols.ts";

export interface GermanManifest {
    months: string[];
    /** ⚠ Includes the corpus's own misspelling `Jahrunderts`, so the rule still fires on it. */
    ordinalNouns: string[];
    weakEn: string[];
    /** ⚠ The full licenser set is `weakEn` PLUS these — articles license the reading, not the -en ending. */
    ordinalLicensersExtra: string[];
    ordinals: { irregularStems: Record<string, string>; suffixBelow20: string; suffixFrom20: string };
    dottedAbbrev: Record<string, string>;
    letterNames: Record<string, string>;
    phonotactics: { vowels: string; onsets: string[]; codas: string[]; digraphs: string[] };
    /** ⚠ STEMS — the rule appends `\p{L}*`, so each matches its inflected forms. */
    measureStems: string[];
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
    /** The shared symbol tier's data — moved verbatim, comments included. See the jsonc. */
    symbolTier: {
        percent: CountForms;
        currency: Record<string, CountForms>;
        units: Record<string, CountForms>;
        magnitudes: string[];
        ampersand: string;
        multiply: { times: string; by?: string };
        exponentWords: { squared: CountForms; cubed: CountForms; position?: "before" | "after" };
        bareExponent: { squared: string; cubed: string; power: string; negative: string };
    };
}

/** The consolidated hand-authored German data tables (see german.jsonc). */
export const MANIFEST = loadManifest<GermanManifest>(import.meta.url, "german.jsonc");

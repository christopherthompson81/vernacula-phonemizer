/**
 * Loads the Catalan data manifest (catalan.jsonc) once at module init and exposes it typed. The hand-authored
 * DATA (vowel realisation + reduction map, accent/front sets, nasal + spirantization + final-devoicing +
 * palatal sets, function words, clause punctuation, number words) lives in the JSONC; the ALGORITHMS that
 * consume it stay in the sibling modules (g2p.ts, catalan.ts, numbers.ts).
 */

import { loadManifest } from "../../core/loadManifest.ts";

export interface VowelReal {
    stressed: string;
    reduced: string;
}

export interface CatalanManifest {
    vowels: Record<string, VowelReal>;
    accentedVowels: string;
    frontVowels: string;
    nasals: string[];
    spirantize: Record<string, string>;
    finalDevoice: Record<string, string>;
    palatals: string[];
    functionWords: string[];
    clausePunctuation: Record<string, string>;
    numbers: {
        ones: string[];
        tens: string[];
        hundreds: string[];
        thousand: string;
        million: { sg: string; pl: string };
        and: string;
        decimalConnector: string;
    };
}

/** The consolidated hand-authored Catalan data tables (see catalan.jsonc). */
export const MANIFEST = loadManifest<CatalanManifest>(import.meta.url, "catalan.jsonc");

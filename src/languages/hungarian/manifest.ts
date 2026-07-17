/**
 * Loads the Hungarian data manifest (hungarian.jsonc) once at module init and exposes it typed. Holds the
 * hand-authored longest-match orthography→IPA rule table (digraphs + their geminate forms), clause punctuation,
 * and the number words. The ALGORITHMS (the longest-match scan + doubled-consonant gemination + fixed
 * first-syllable stress, the cardinal compositor) stay in code (hungarian.ts / numbers.ts).
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface HungarianManifest {
    rules: [string, string, boolean][];
    clausePunctuation: Record<string, string>;
    numbers: {
        units: string[];
        teens: string[];
        tens: string[];
        tensPrefix: Record<string, string>;
        hundred: string;
        thousand: string;
        million: string;
        milliard: string;
    };
}

/** The consolidated hand-authored Hungarian data tables (see hungarian.jsonc). */
export const MANIFEST = loadManifest<HungarianManifest>(import.meta.url, "hungarian.jsonc");

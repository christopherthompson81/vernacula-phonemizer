/**
 * Loads the Kinyarwanda data manifest (kinyarwanda.jsonc) once at module init and exposes it typed. Holds the
 * context-free hand-authored DATA: the orthography→IPA grapheme table (palatals, prenasals, length) + clause
 * punctuation + number words. The ALGORITHMS (the greedy longest-match scan, the cardinal compositor) stay in code
 * (kinyarwanda.ts / numbers.ts).
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface KinyarwandaManifest {
    language: string;
    name: string;
    script: string;
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: {
        units: string[];
        ten: string;
        tens: string;
        hundred: string;
        thousand: string;
        and: string;
    };
}

/** The consolidated hand-authored Kinyarwanda data tables (see kinyarwanda.jsonc). */
export const MANIFEST = loadManifest<KinyarwandaManifest>(import.meta.url, "kinyarwanda.jsonc");

// Grapheme keys sorted LENGTH DESC so the greedy scan tries trigraphs (shy) before digraphs before singles.
export const GRAPHEME_KEYS = Object.keys(MANIFEST.graphemes).sort((a, b) => b.length - a.length);

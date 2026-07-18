/**
 * Loads the Shona data manifest (shona.jsonc) once at module init and exposes it typed. Holds the context-free
 * hand-authored DATA: the orthography→IPA grapheme table (whistled sibilants, prenasalized clusters, breathy
 * digraphs, implosives) + clause punctuation + number words. The ALGORITHMS (the greedy longest-match scan, the
 * cardinal compositor) stay in code (shona.ts / numbers.ts).
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface ShonaManifest {
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

/** The consolidated hand-authored Shona data tables (see shona.jsonc). */
export const MANIFEST = loadManifest<ShonaManifest>(import.meta.url, "shona.jsonc");

// Grapheme keys sorted LENGTH DESC so the greedy scan tries trigraphs (ng', tsv) before digraphs before singles.
export const GRAPHEME_KEYS = Object.keys(MANIFEST.graphemes).sort((a, b) => b.length - a.length);

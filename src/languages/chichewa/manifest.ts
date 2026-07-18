/**
 * Loads the Chichewa data manifest (chichewa.jsonc) once at module init and exposes it typed. Holds the
 * context-free hand-authored DATA: the orthography→IPA grapheme table (implosives, prenasalised clusters,
 * aspirates) + clause punctuation + number words. The ALGORITHM (the greedy longest-match scan) stays in code.
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface ChichewaManifest {
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

/** The consolidated hand-authored Chichewa data tables (see chichewa.jsonc). */
export const MANIFEST = loadManifest<ChichewaManifest>(import.meta.url, "chichewa.jsonc");

// Grapheme keys sorted LENGTH DESC so the greedy scan tries trigraphs (ng', nkh, ndz) before digraphs before singles.
export const GRAPHEME_KEYS = Object.keys(MANIFEST.graphemes).sort((a, b) => b.length - a.length);

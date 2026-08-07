/**
 * Loads the Kirundi data manifest (kirundi.jsonc) once at module init and exposes it typed. Holds the
 * context-free hand-authored DATA: the orthography→IPA grapheme table (palatals, prenasals, length) + clause
 * punctuation + number words. The ALGORITHMS (the greedy longest-match scan, the cardinal compositor) stay in code
 * (kinyarwanda.ts / numbers.ts).
 */
import { loadManifest } from "../../core/loadManifest.ts";
// Kirundi shares Kinyarwanda's numeral system, so it reuses that table's type (and its compositor).
import type { RwandaRundiNumbers } from "../kinyarwanda/manifest.ts";

export interface KirundiManifest {
    language: string;
    name: string;
    script: readonly string[];
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: RwandaRundiNumbers;
}

/** The consolidated hand-authored Kirundi data tables (see kirundi.jsonc). */
export const MANIFEST = loadManifest<KirundiManifest>(import.meta.url, "kirundi.jsonc");

// Grapheme keys sorted LENGTH DESC so the greedy scan tries trigraphs (shy) before digraphs before singles.
export const GRAPHEME_KEYS = Object.keys(MANIFEST.graphemes).sort((a, b) => b.length - a.length);

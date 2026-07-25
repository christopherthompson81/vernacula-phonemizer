/**
 * Loads the Georgian data manifest (georgian.jsonc) once at module init and exposes it typed. Georgian (Mkhedruli) is
 * an essentially ONE-LETTER-ONE-PHONEME orthography, so the g2p is a greedy longest-match scan (georgian.ts) over the
 * 33-letter grapheme table + ONE context rule (word-final voiced-stop devoicing, in georgian.ts). No digraphs; every
 * table key is a single letter.
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface GeorgianManifest {
    language: string;
    name: string;
    script: string;
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
}

/** The consolidated hand-authored Georgian data tables (see georgian.jsonc). */
export const MANIFEST = loadManifest<GeorgianManifest>(import.meta.url, "georgian.jsonc");

// Grapheme keys sorted LENGTH DESC (all length 1 for Georgian, but the shared pattern keeps the scan uniform).
export const GRAPHEME_KEYS = Object.keys(MANIFEST.graphemes).sort((a, b) => b.length - a.length);

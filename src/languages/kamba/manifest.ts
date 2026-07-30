/**
 * Loads the Kamba data manifest (kamba.jsonc) once at module init and exposes it typed. Holds the context-free
 * hand-authored DATA: the orthography→IPA grapheme table + clause punctuation. There is NO algorithm — the whole g2p
 * is the greedy longest-match scan (kamba.ts), the Kikuyu pattern.
 */
import { loadManifest } from "../../core/loadManifest.ts";
import type { E5xNumberTable } from "../kikuyu/e5xNumbers.ts";

export interface KambaManifest {
    language: string;
    name: string;
    script: string;
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
    /** The cardinal number words (the citation/counting series) — the composer is the shared E5x algorithm. */
    numbers: E5xNumberTable;
}

/** The consolidated hand-authored Kamba data tables (see kamba.jsonc). */
export const MANIFEST = loadManifest<KambaManifest>(import.meta.url, "kamba.jsonc");

// Grapheme keys sorted LENGTH DESC so the greedy scan tries the trigraphs (⟨ng'⟩) before digraphs (prenasal, ⟨th⟩,
// vowel-length) before the single vowels/consonants.
export const GRAPHEME_KEYS = Object.keys(MANIFEST.graphemes).sort((a, b) => b.length - a.length);

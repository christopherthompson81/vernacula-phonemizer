/**
 * Loads the Luo (Dholuo) data manifest (luo.jsonc) once at module init and exposes it typed. Holds the context-free
 * hand-authored DATA: the orthography→IPA grapheme table (dental/palatal/prenasal digraphs, ⟨ng'⟩, 5 default-ATR
 * vowels) + clause punctuation. The high-vowel-glide ALGORITHM stays in code (luo.ts).
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface LuoManifest {
    language: string;
    name: string;
    script: string;
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
}

/** The consolidated hand-authored Luo data tables (see luo.jsonc). */
export const MANIFEST = loadManifest<LuoManifest>(import.meta.url, "luo.jsonc");

// Grapheme keys sorted LENGTH DESC so the greedy scan tries ng' → the two-letter digraphs (mb/nd/nj/ng/ny/ch/dh/th/sh)
// → singles.
export const GRAPHEME_KEYS = Object.keys(MANIFEST.graphemes).sort((a, b) => b.length - a.length);

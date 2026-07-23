/**
 * Loads the Mooré data manifest (mossi.jsonc) once at module init and exposes it typed. Holds the context-free
 * hand-authored DATA: the orthography→IPA grapheme table (ATR-ish vowels ⟨ɛ ɩ ʋ⟩, nasal + length digraphs, ⟨r⟩=ɾ)
 * + clause punctuation. The consonant-gemination ALGORITHM stays in code (mossi.ts).
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface MossiManifest {
    language: string;
    name: string;
    script: string;
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
}

/** The consolidated hand-authored Mooré data tables (see mossi.jsonc). */
export const MANIFEST = loadManifest<MossiManifest>(import.meta.url, "mossi.jsonc");

// Grapheme keys sorted LENGTH DESC so the greedy scan tries the nasal-long/length digraphs (ãa, aa, ɛɛ, ʋʋ…) and
// the combining-tilde nasals (ɛ̃ ɩ̃ ʋ̃) before the single vowels, and ⟨ny⟩ before ⟨n⟩.
export const GRAPHEME_KEYS = Object.keys(MANIFEST.graphemes).sort((a, b) => b.length - a.length);

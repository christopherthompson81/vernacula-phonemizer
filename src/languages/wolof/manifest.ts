/**
 * Loads the Wolof data manifest (wolof.jsonc) once at module init and exposes it typed. Holds the context-free
 * hand-authored DATA: the orthography→IPA grapheme table (ATR vowels, vowel-length digraphs, palatal ⟨c j⟩) +
 * clause punctuation. The gemination + nasal-assimilation ALGORITHM stays in code.
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface WolofManifest {
    language: string;
    name: string;
    script: readonly string[];
    graphemes: Record<string, string>;
    /** The vowel letters (plain + ATR ⟨é ó⟩ + ⟨ë à⟩) — a doubled one is length, not a geminate. */
    vowelLetters: readonly string[];
    clausePunctuation: Record<string, string>;
}

/** The consolidated hand-authored Wolof data tables (see wolof.jsonc). */
export const MANIFEST = loadManifest<WolofManifest>(import.meta.url, "wolof.jsonc");

// Grapheme keys sorted LENGTH DESC so the greedy scan tries vowel digraphs (aa, ée, óo) before singles.
export const GRAPHEME_KEYS = Object.keys(MANIFEST.graphemes).sort((a, b) => b.length - a.length);

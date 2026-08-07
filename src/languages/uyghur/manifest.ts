/**
 * Loads the Uyghur data manifest (uyghur.jsonc) once at module init and exposes it typed. Holds the context-free
 * hand-authored DATA: the Uyghur-Arabic-letter → IPA grapheme table (8 written vowels, hamza glottal) + clause
 * punctuation. The word-final obstruent-devoicing ALGORITHM stays in code.
 */
import { loadManifest } from "../../core/loadManifest.ts";
import type { NumbersDef } from "../../core/numbers.ts";

export interface UyghurManifest {
    language: string;
    name: string;
    script: readonly string[];
    graphemes: Record<string, string>;
    /** Turkic cardinal number spellings (Uyghur Arabic); composed by uyghur.ts, phonemized by the same g2p. */
    numbers: NumbersDef;
    clausePunctuation: Record<string, string>;
}

/** The consolidated hand-authored Uyghur data tables (see uyghur.jsonc). */
export const MANIFEST = loadManifest<UyghurManifest>(import.meta.url, "uyghur.jsonc");

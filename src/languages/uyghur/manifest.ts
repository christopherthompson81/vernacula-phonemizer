/**
 * Loads the Uyghur data manifest (uyghur.jsonc) once at module init and exposes it typed. Holds the context-free
 * hand-authored DATA: the Uyghur-Arabic-letter → IPA grapheme table (8 written vowels, hamza glottal) + clause
 * punctuation. The word-final obstruent-devoicing ALGORITHM stays in code.
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface UyghurManifest {
    language: string;
    name: string;
    script: string;
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
}

/** The consolidated hand-authored Uyghur data tables (see uyghur.jsonc). */
export const MANIFEST = loadManifest<UyghurManifest>(import.meta.url, "uyghur.jsonc");

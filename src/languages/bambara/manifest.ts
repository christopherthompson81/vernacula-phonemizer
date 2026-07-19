/**
 * Loads the Bambara data manifest (bambara.jsonc) once at module init and exposes it typed. Holds the
 * context-free hand-authored DATA: the orthography→IPA grapheme table (⟨c⟩→t͡ʃ, ⟨j⟩→d͡ʒ, ⟨ny⟩→ɲ) + clause
 * punctuation. The nasalisation ALGORITHM (a syllable-final ⟨n⟩ nasalises the preceding vowel) stays in code.
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface BambaraManifest {
    language: string;
    name: string;
    script: string;
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
}

/** The consolidated hand-authored Bambara data tables (see bambara.jsonc). The scanner handles the digraphs
 *  (sh, ny) and the ⟨n m⟩ nasalisation explicitly, so no length-sorted key list is needed. */
export const MANIFEST = loadManifest<BambaraManifest>(import.meta.url, "bambara.jsonc");

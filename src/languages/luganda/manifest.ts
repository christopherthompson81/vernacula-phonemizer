/**
 * Loads the Luganda data manifest (luganda.jsonc) once at module init and exposes it typed. Holds the
 * context-free hand-authored DATA: the orthography→IPA grapheme table (prenasalised units, vowel-length digraphs,
 * ⟨ng'⟩, labialisation) + clause punctuation. The gemination + vowel-lengthening ALGORITHM stays in code.
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface LugandaManifest {
    language: string;
    name: string;
    script: string;
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
}

/** The consolidated hand-authored Luganda data tables (see luganda.jsonc). */
export const MANIFEST = loadManifest<LugandaManifest>(import.meta.url, "luganda.jsonc");

// Grapheme keys sorted LENGTH DESC so the greedy scan tries nng'/nny/ng'/ny, the Cw + prenasalised digraphs, and
// the vowel-length digraphs before singles.
export const GRAPHEME_KEYS = Object.keys(MANIFEST.graphemes).sort((a, b) => b.length - a.length);

/**
 * Loads the Umbundu data manifest (umbundu.jsonc) once at module init and exposes it typed. Holds the context-free
 * hand-authored DATA: the orthography→IPA grapheme table (prenasalised clusters, ⟨c⟩=t͡ʃ, ⟨ñ⟩=ɲ, ⟨ng'⟩=ŋ) + clause
 * punctuation. The ALGORITHM (the greedy longest-match scan + tone-accent stripping) stays in code (umbundu.ts).
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface UmbunduManifest {
    language: string;
    name: string;
    script: string;
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
}

/** The consolidated hand-authored Umbundu data tables (see umbundu.jsonc). */
export const MANIFEST = loadManifest<UmbunduManifest>(import.meta.url, "umbundu.jsonc");

// Grapheme keys sorted LENGTH DESC so the greedy scan tries the trigraph ⟨ng'⟩ before prenasal digraphs before singles.
export const GRAPHEME_KEYS = Object.keys(MANIFEST.graphemes).sort((a, b) => b.length - a.length);

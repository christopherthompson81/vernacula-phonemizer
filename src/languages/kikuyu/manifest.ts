/**
 * Loads the Kikuyu data manifest (kikuyu.jsonc) once at module init and exposes it typed. Holds the context-free
 * hand-authored DATA: the orthography→IPA grapheme table (7-vowel ATR ⟨ĩ⟩=e/⟨ũ⟩=o, fricativized ⟨b⟩=β/⟨th⟩=ð/⟨g⟩=ɣ,
 * prenasal digraphs) + clause punctuation. There is NO algorithm — the whole g2p is the greedy longest-match scan.
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface KikuyuManifest {
    language: string;
    name: string;
    script: string;
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
}

/** The consolidated hand-authored Kikuyu data tables (see kikuyu.jsonc). */
export const MANIFEST = loadManifest<KikuyuManifest>(import.meta.url, "kikuyu.jsonc");

// Grapheme keys sorted LENGTH DESC so the greedy scan tries ⟨ng'⟩ before ⟨ng⟩, the prenasal/⟨th ny⟩ + vowel-length
// digraphs before the single vowels, etc.
export const GRAPHEME_KEYS = Object.keys(MANIFEST.graphemes).sort((a, b) => b.length - a.length);

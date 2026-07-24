/**
 * Loads the Mongolian data manifest (mongolian.jsonc) once at module init and exposes it typed. Holds the
 * hand-authored letter→IPA tables (single vowels, doubled long vowels, diphthongs, consonants), the back-harmony
 * trigger set, and clause punctuation. The ALGORITHMS that read them stay in code: the greedy Cyrillic scan +
 * harmony (g2p.ts) and the deep-orthography reduction/deletion + final devoicing (mongolian.ts).
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface MongolianManifest {
    language: string;
    name: string;
    script: string;
    vowels: Record<string, string>;
    longVowels: Record<string, string>;
    diphthongs: Record<string, string>;
    consonants: Record<string, string>;
    backVowels: string;
    clausePunctuation: Record<string, string>;
}

/** The consolidated hand-authored Mongolian data tables (see mongolian.jsonc). */
export const MANIFEST = loadManifest<MongolianManifest>(import.meta.url, "mongolian.jsonc");

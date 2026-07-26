/**
 * Loads the Latvian data manifest (latvian.jsonc) once at module init and exposes it typed. Holds the context-free
 * hand-authored DATA: the vowel + long-vowel + consonant tables, the voicing pairs, clause punctuation, and the
 * number words. The ALGORITHMS that read them stay in code (g2p.ts / latvian.ts / numbers.ts): the scan, the native
 * ⟨o⟩→[uɔ̯] + diphthong handling, voicing/devoicing, first-syllable stress, the tokenizer, and the compositor.
 */

import { loadManifest } from "../../core/loadManifest.ts";

export interface LatvianManifest {
    vowels: Record<string, string>;
    longVowels: Record<string, string>;
    consonants: Record<string, string>;
    consonantDigraphs: Record<string, string>;
    voicing: {
        toVoiceless: Record<string, string>;
        toVoiced: Record<string, string>;
    };
    clausePunctuation: Record<string, string>;
    numbers: {
        units: string[];
        teens: string[];
        tens: string[];
        hundred: { one: string; many: string };
        thousand: { one: string; many: string };
        million: { one: string; many: string };
    };
}

/** The consolidated hand-authored Latvian data tables (see latvian.jsonc). */
export const MANIFEST = loadManifest<LatvianManifest>(import.meta.url, "latvian.jsonc");

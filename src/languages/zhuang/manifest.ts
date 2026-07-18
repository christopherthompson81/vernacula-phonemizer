/**
 * Loads the Zhuang data manifest (zhuang.jsonc) once at module init and exposes it typed. Holds the hand-authored
 * DATA: the multi-letter onset table, the single-consonant + vowel tables, the vowel digraphs, the tone-letter→Chao
 * map, clause punctuation, and the number words. The ALGORITHMS (the longest-match scan + tone-letter handling +
 * word-initial glottal, the cardinal compositor) stay in code (zhuang.ts / numbers.ts).
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface ZhuangManifest {
    onsets: Record<string, string>;
    consonants: Record<string, string>;
    vowelDigraphs: Record<string, string>;
    vowels: Record<string, string>;
    tones: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: {
        units: string[];
        ten: string;
        hundred: string;
        thousand: string;
        million: string;
    };
}

/** The consolidated hand-authored Zhuang data tables (see zhuang.jsonc). */
export const MANIFEST = loadManifest<ZhuangManifest>(import.meta.url, "zhuang.jsonc");

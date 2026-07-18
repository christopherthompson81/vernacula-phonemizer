/**
 * Loads the Kurmanji data manifest (kurmanji.jsonc) once at module init and exposes it typed. Holds the
 * hand-authored DATA: the ⟨xw⟩ digraph, the vowel/consonant tables, clause punctuation, and the number words.
 * The ALGORITHMS (the near-phonemic scan + final-syllable stress, the cardinal compositor) stay in code
 * (kurmanji.ts / numbers.ts).
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface KurmanjiManifest {
    digraphs: Record<string, string>;
    vowels: Record<string, string>;
    consonants: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: {
        units: string[];
        teens: string[];
        tens: string[];
        connector: string;
        hundred: string;
        thousand: string;
        million: string;
    };
}

/** The consolidated hand-authored Kurmanji data tables (see kurmanji.jsonc). */
export const MANIFEST = loadManifest<KurmanjiManifest>(import.meta.url, "kurmanji.jsonc");

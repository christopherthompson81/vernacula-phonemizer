/**
 * Loads the Somali data manifest (somali.jsonc) once at module init and exposes it typed. Holds the context-free
 * hand-authored DATA: the long/short vowel tables, the consonant digraphs + single-letter table, clause
 * punctuation, and the number words. The ALGORITHMS (the digraph-aware scan + geminate detection, the units-first
 * cardinal compositor) stay in code (g2p.ts / somali.ts / numbers.ts).
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface SomaliManifest {
    longVowels: Record<string, string>;
    shortVowels: Record<string, string>;
    digraphs: Record<string, string>;
    consonants: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: {
        ones: string[];
        tens: string[];
        connector: string;
        hundred: string;
        thousand: string;
        million: string;
    };
}

/** The consolidated hand-authored Somali data tables (see somali.jsonc). */
export const MANIFEST = loadManifest<SomaliManifest>(import.meta.url, "somali.jsonc");

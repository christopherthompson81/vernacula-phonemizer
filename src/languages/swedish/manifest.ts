/**
 * Loads the Swedish data manifest (swedish.jsonc) once at module init and exposes it typed. The hand-authored
 * DATA tables (vowel length/quality maps, the special-digraph and retroflex maps, front-vowel set, clause
 * punctuation, number words) live in the JSONC; the ALGORITHMS that consume them stay in the sibling modules
 * (g2p.ts, swedish.ts, numbers.ts).
 */

import { loadManifest } from "../../core/loadManifest.ts";

export interface SwedishManifest {
    vowelChars: string;
    frontVowels: string;
    vowels: {
        long: Record<string, string>;
        short: Record<string, string>;
        longBeforeR: Record<string, string>;
        shortBeforeR: Record<string, string>;
    };
    digraphs: Record<string, string>;
    consonants: Record<string, string>;
    retroflex: Record<string, string>;
    exceptions: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: {
        ones: string[];
        tens: string[];
        hundred: string;
        thousand: string;
        million: { sg: string; pl: string };
    };
}

/** The consolidated hand-authored Swedish data tables (see swedish.jsonc). */
export const MANIFEST = loadManifest<SwedishManifest>(import.meta.url, "swedish.jsonc");

/**
 * Loads the consolidated Norwegian Bokmål data manifest (norwegian.jsonc) once and exposes it typed. Holds the
 * hand-authored DATA (vowel length/quality tables, digraphs, consonants, retroflex pairs, front-vowel set, number
 * words); the ALGORITHMS (g2p scan, complementary length, retroflex, silent-d, stress, numbers) stay in norwegian.ts.
 */
import { loadManifest } from "../../core/loadManifest.ts";
import type { NumbersDef } from "../../core/numbers.ts";

export interface NorwegianManifest {
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
    clausePunctuation: Record<string, string>;
    numbers: NumbersDef;
}

export const MANIFEST = loadManifest<NorwegianManifest>(import.meta.url, "norwegian.jsonc");

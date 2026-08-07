/**
 * Loads the Danish data manifest (danish.jsonc). Holds the base letter→IPA tables (vowel qualities, consonants);
 * the CONTEXT RULES (soft-d, coda-r, final-t→d, reduction, silent-h) live in the algorithm (g2p.ts / danish.ts).
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface DanishManifest {
    language: string;
    name: string;
    script: readonly string[];
    vowels: Record<string, string>;
    consonants: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: {
        ones: string[];
        tens: string[];
        connector: string;
        hundred: { one: string; word: string };
        thousand: { one: string; word: string };
        million: { one: string; plural: string };
        billion: { one: string; plural: string };
    };
}

/** The consolidated hand-authored Danish data tables (see danish.jsonc). */
export const MANIFEST = loadManifest<DanishManifest>(import.meta.url, "danish.jsonc");

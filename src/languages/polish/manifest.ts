/** Loads the consolidated Polish data manifest (polish.jsonc) once and exposes it typed. Algorithms live in g2p.ts. */
import { loadManifest } from "../../core/loadManifest.ts";

export interface PolishManifest {
    vowels: Record<string, string>;
    nasalVowels: Record<string, string>;
    consonants: Record<string, string>;
    digraphs: Record<string, string>;
    softI: Record<string, string>;
    voicing: {
        toVoiceless: Record<string, string>;
        toVoiced: Record<string, string>;
    };
    clausePunctuation: Record<string, string>;
}

export const MANIFEST = loadManifest<PolishManifest>(import.meta.url, "polish.jsonc");

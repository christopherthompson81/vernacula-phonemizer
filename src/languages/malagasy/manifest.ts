/**
 * Loads the Malagasy data manifest (malagasy.jsonc) once at module init and exposes it typed. Holds the
 * context-free hand-authored DATA: the vowel/consonant tables, clause punctuation, and number words. The
 * ALGORITHMS that read them stay in code (g2p.ts / malagasy.ts / numbers.ts): the scan (o→u, y→i, retroflex
 * affricates, prenasalized stops), penultimate stress, and the units-first cardinal compositor.
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface MalagasyManifest {
    vowels: Record<string, string>;
    consonants: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: {
        ones: string[];
        tens: string[];
        hundreds: string[];
        connector: string;
        join: string;
        thousand: string;
        million: string;
        zero: string;
    };
}

/** The consolidated hand-authored Malagasy data tables (see malagasy.jsonc). */
export const MANIFEST = loadManifest<MalagasyManifest>(import.meta.url, "malagasy.jsonc");

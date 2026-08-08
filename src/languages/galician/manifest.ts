/**
 * Loads the Galician data manifest (galician.jsonc) once at module init and exposes it typed. Holds the context-
 * free hand-authored DATA: the vowel classes, the accented-vowel→base map, the nasal + spirantization sets, the
 * function-word list, clause punctuation, and the number words. The ALGORITHMS that read it stay in code
 * (g2p.ts / galician.ts / numbers.ts): the scan, glide classification, nasal velarization, spirantization,
 * rule-based stress, the tokenizer, and the cardinal compositor.
 */

import { loadManifest } from "../../core/loadManifest.ts";

export interface GalicianManifest {
    vowels: {
        strong: string;
        weakUnaccented: string;
        weakAccented: string;
        front: string;
    };
    accents: Record<string, string>;
    nasals: string[];
    velars: readonly string[];
    spirantize: Record<string, string>;
    functionWords: string[];
    clausePunctuation: Record<string, string>;
    numbers: {
        ones: string[];
        tens: string[];
        hundreds: string[];
        hundredExact: string;
        thousand: string;
        connector: string;
        decimalConnector: string;
        million: { one: string; many: string };
        billion: { one: string; many: string };
    };
}

/** The consolidated hand-authored Galician data tables (see galician.jsonc). */
export const MANIFEST = loadManifest<GalicianManifest>(import.meta.url, "galician.jsonc");

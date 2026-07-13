/**
 * Loads the Spanish data manifest (spanish.jsonc) once at module init and exposes it typed. Holds the context-
 * free hand-authored DATA: the vowel classes, the accented-vowel→base map, the nasal + spirantization sets, the
 * function-word list, clause punctuation, and the number words. The ALGORITHMS that read them stay in code
 * (g2p.ts / spanish.ts / numbers.ts): the scan, glide classification, spirantization, stress, and the compositor.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseJsonc } from "../../core/jsonc.ts";

export interface SpanishManifest {
    vowels: {
        strong: string;
        weakUnaccented: string;
        weakAccented: string;
        front: string;
    };
    accents: Record<string, string>;
    nasals: string[];
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
        scales: { value: number; one: string; many: string }[];
    };
}

const dir = dirname(fileURLToPath(import.meta.url));

/** The consolidated hand-authored Spanish data tables (see spanish.jsonc). */
export const MANIFEST = parseJsonc<SpanishManifest>(
    readFileSync(join(dir, "spanish.jsonc"), "utf8"),
);

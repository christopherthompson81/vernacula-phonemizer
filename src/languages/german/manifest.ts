/**
 * Loads the German data manifest (german.jsonc) once at module init and exposes it typed. The hand-authored
 * DATA tables (vowel length maps, final-devoicing pairs, exception word-lists, clause punctuation, the
 * morphology tables, number words) live in the JSONC; the ALGORITHMS that consume them stay in the sibling
 * modules (g2p.ts, german.ts, morphology.ts, numbers.ts).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseJsonc } from "../../core/jsonc.ts";

export interface GermanManifest {
    vowelChars: string;
    vowels: {
        long: Record<string, string>;
        short: Record<string, string>;
        longOf: Record<string, string>;
        shortOf: Record<string, string>;
    };
    consonants: Record<string, string>;
    voicedFinal: Record<string, string>;
    shortMonosyllables: string[];
    longCh: string[];
    clausePunctuation: Record<string, string>;
    morphology: {
        prefixUnstressed: string[];
        prefixStressed: string[];
        suffixes: string[];
        vowelInitialSuffixes: string[];
        ambiguousPrefixes: string[];
        linkingElements: string[];
        validOnsets: string[];
        prefixIpa: Record<string, string>;
        suffixIpa: Record<string, string>;
    };
    numbers: {
        ones: string[];
        tens: string[];
        compoundOne: string;
        connector: string;
        hundred: string;
        thousand: string;
        million: { sg: string; pl: string };
    };
}

const dir = dirname(fileURLToPath(import.meta.url));

/** The consolidated hand-authored German data tables (see german.jsonc). */
export const MANIFEST = parseJsonc<GermanManifest>(
    readFileSync(join(dir, "german.jsonc"), "utf8"),
);

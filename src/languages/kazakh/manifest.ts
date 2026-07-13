/**
 * Loads the Kazakh data manifest (kazakh.jsonc) once at module init and exposes it typed. Holds the hand-authored
 * vowel / glide / consonant letter→IPA tables, the front-vowel harmony trigger set, clause punctuation, and the
 * pre-phonemized cardinal number forms. The ALGORITHMS that read them stay in code (g2p.ts / kazakh.ts /
 * numbers.ts): the Cyrillic scan, STRESSPOSN_1RU stress, epenthesis, ɫ→l lightening, and the number compositor.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseJsonc } from "../../core/jsonc.ts";

export interface KazakhManifest {
    vowels: Record<string, string>;
    glides: Record<string, string>;
    consonants: Record<string, string>;
    frontVowels: string;
    clausePunctuation: Record<string, string>;
    numbers: {
        units: string[];
        tens: string[];
        hundred: string;
        thousand: string;
        million: string;
    };
}

const dir = dirname(fileURLToPath(import.meta.url));

/** The consolidated hand-authored Kazakh data tables (see kazakh.jsonc). */
export const MANIFEST = parseJsonc<KazakhManifest>(
    readFileSync(join(dir, "kazakh.jsonc"), "utf8"),
);

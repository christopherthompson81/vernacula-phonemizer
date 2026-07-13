/**
 * Loads the French data manifest (french.jsonc) once at module init and exposes it typed. The hand-authored
 * DATA tables (vowel-letter inventory, oral/nasal vowel-multigraph tables, yod groups, sounded-final set, clause
 * punctuation, liaison + h-aspiré lists, number words) live in the JSONC; the ALGORITHMS that consume them stay
 * in the sibling modules (g2p.ts, french.ts, numbers.ts).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseJsonc } from "../../core/jsonc.ts";

export interface FrenchManifest {
    vowelLetters: string;
    vowelPhonemes: string;
    vowelGroups: [string, string][];
    nasalGroups: [string, string][];
    finalSounded: string[];
    yodDouble: [string, string][];
    yodFinal: [string, string][];
    clausePunctuation: Record<string, string>;
    liaison: Record<string, string>;
    hAspire: string[];
    numbers: {
        small: string[];
        tens: string[];
        magnitudes: {
            sixty: string;
            eighty: string;
            hundred: string;
            thousand: string;
            million: string;
            millions: string;
        };
        decimalSeparator: string;
    };
}

const dir = dirname(fileURLToPath(import.meta.url));

/** The consolidated hand-authored French data tables (see french.jsonc). */
export const MANIFEST = parseJsonc<FrenchManifest>(
    readFileSync(join(dir, "french.jsonc"), "utf8"),
);

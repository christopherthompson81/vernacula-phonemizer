/**
 * Loads the consolidated Czech data manifest (czech.jsonc) once at module init and exposes it typed. The
 * hand-authored DATA tables (vowel + consonant maps, palatalisation table, voicing-assimilation pairs, clause
 * punctuation, number words) live in the JSONC; the ALGORITHMS that consume them stay in the sibling modules
 * (g2p.ts, numbers.ts, czech.ts).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseJsonc } from "../../core/jsonc.ts";

interface Agreement {
    sg: string;
    paucal: string;
    plural: string;
}

export interface CzechManifest {
    vowels: Record<string, string>;
    palatalisation: { map: Record<string, string>; triggers: string[] };
    consonants: Record<string, string>;
    voicing: {
        toVoiceless: Record<string, string>;
        toVoiced: Record<string, string>;
    };
    clausePunctuation: Record<string, string>;
    numbers: {
        units: string[];
        teens: string[];
        tens: string[];
        hundreds: string[];
        magnitudes: { thousand: Agreement; million: Agreement };
    };
}

const dir = dirname(fileURLToPath(import.meta.url));

/** The consolidated hand-authored Czech data tables (see czech.jsonc). */
export const MANIFEST = parseJsonc<CzechManifest>(
    readFileSync(join(dir, "czech.jsonc"), "utf8"),
);

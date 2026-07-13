/**
 * Loads the European Portuguese data manifest (portuguese.jsonc) once at module init and exposes it typed. Holds
 * the context-free hand-authored DATA: accent letter classes, the vowel-letter→IPA table, the reduction and
 * nasalization maps, the voiced-consonant / liquid sets, the function-word list, clause punctuation, and the
 * number words. The ALGORITHMS that read them stay in code (g2p.ts / portuguese.ts / numbers.ts): the scan,
 * stress, reduction pass, sibilant voicing, and the cardinal compositor. The lexical correction table stays in
 * the sibling lexicon.tsv / lexicon-manual.tsv, which the manifest only references.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseJsonc } from "../../core/jsonc.ts";

export interface PortugueseManifest {
    accents: {
        toBase: Record<string, string>;
        acuteGrave: string;
        circumflex: string;
        tilde: string;
    };
    vowelLetters: string;
    frontLetters: string;
    vowelIpa: Record<string, string>;
    reduce: Record<string, string>;
    nasal: Record<string, string>;
    voicedConsonants: string[];
    liquids: string[];
    functionWords: string[];
    clausePunctuation: Record<string, string>;
    numbers: {
        small: string[];
        tens: string[];
        hundreds: string[];
        hundredExact: string;
        thousand: string;
        million: string;
        millionPlural: string;
        connector: string;
        decimalConnector: string;
    };
}

const dir = dirname(fileURLToPath(import.meta.url));

/** The consolidated hand-authored European Portuguese data tables (see portuguese.jsonc). */
export const MANIFEST = parseJsonc<PortugueseManifest>(
    readFileSync(join(dir, "portuguese.jsonc"), "utf8"),
);

/**
 * Loads the Korean data manifest (korean.jsonc) once at module init and exposes it typed. Holds the hand-authored
 * jamo inventories, the onset / vowel / coda letter→IPA tables, the coda-cluster resolution table, the 7-way
 * neutralisation and sandhi class maps, clause punctuation, and the Sino-Korean number words. The ALGORITHMS that
 * read them stay in code (g2p.ts / numbers.ts / korean.ts): Hangul decomposition, cross-syllable sandhi, coda
 * neutralisation, stress, and the myriad-group number compositor. The lexical-tensification exceptions stay in
 * the sibling tensification.tsv (append-heavy wikipron data), which the manifest only references.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseJsonc } from "../../core/jsonc.ts";

export interface KoreanManifest {
    jamo: { onset: string; vowel: string; coda: string };
    onset: Record<string, string>;
    vowel: Record<string, string>;
    coda: Record<string, { cons: string; lc: string; lo: string }>;
    codaPhoneme: Record<string, string>;
    nasalCodas: string;
    neutralize: Record<string, string>;
    obstruentToNasal: Record<string, string>;
    voice: Record<string, string>;
    tense: Record<string, string>;
    tenseJamo: Record<string, string>;
    aspiration: {
        hCodaLenisOnset: Record<string, string>;
        stopCodaHOnset: Record<string, string>;
    };
    clausePunctuation: Record<string, string>;
    numbers: {
        ones: string[];
        ten: string;
        hundred: string;
        thousand: string;
        myriadUnits: string[];
    };
}

const dir = dirname(fileURLToPath(import.meta.url));

/** The consolidated hand-authored Korean data tables (see korean.jsonc). */
export const MANIFEST = parseJsonc<KoreanManifest>(
    readFileSync(join(dir, "korean.jsonc"), "utf8"),
);

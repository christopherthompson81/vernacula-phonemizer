/**
 * Loads the Hebrew data manifest (hebrew.jsonc) once at module init and exposes it typed. Holds the context-free
 * hand-authored DATA: the base consonant→IPA table, the dagesh-hard (bgdkpt) overrides, and the niqqud vowel table.
 * The scan ALGORITHM (dagesh/shin-sin, vav specials, sheva, mater lectionis, patach genuvah) stays in hebrew.ts.
 */
import { loadManifest } from "../../core/loadManifest.ts";

/** Cardinal number words (niqqud-authored) — composed by numbers.ts, rendered by the rule g2p. */
export interface HebrewNumbers {
    point: string;
    and: string;
    unitsF: string[];
    unitsM: string[];
    teensOnes: string[];
    ten: string;
    teenSuffix: string;
    tens: string[];
    hundred: string;
    twoHundred: string;
    hundredsPlural: string;
    thousand: string;
    twoConstruct: string;
    twoThousand: string;
    thousandsPlural: string;
    thousandsConstruct: string[];
    million: string;
    milliard: string;
}

export interface HebrewManifest {
    language: string;
    name: string;
    script: readonly string[];
    consonants: Record<string, string>;
    dageshHard: Record<string, string>;
    vowels: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: HebrewNumbers;
}

/** The consolidated hand-authored Hebrew data tables (see hebrew.jsonc). */
export const MANIFEST = loadManifest<HebrewManifest>(import.meta.url, "hebrew.jsonc");

/**
 * Loads the Hebrew data manifest (hebrew.jsonc) once at module init and exposes it typed. Holds the context-free
 * hand-authored DATA: the base consonant→IPA table, the dagesh-hard (bgdkpt) overrides, and the niqqud vowel table.
 * The scan ALGORITHM (dagesh/shin-sin, vav specials, sheva, mater lectionis, patach genuvah) stays in hebrew.ts.
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface HebrewManifest {
    language: string;
    name: string;
    script: string;
    consonants: Record<string, string>;
    dageshHard: Record<string, string>;
    vowels: Record<string, string>;
    clausePunctuation: Record<string, string>;
}

/** The consolidated hand-authored Hebrew data tables (see hebrew.jsonc). */
export const MANIFEST = loadManifest<HebrewManifest>(import.meta.url, "hebrew.jsonc");

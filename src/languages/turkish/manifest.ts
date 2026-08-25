/**
 * Loads the Turkish data manifest (turkish.jsonc) once at module init and exposes it typed. Holds the context-
 * free hand-authored DATA: the vowel letter→IPA table + harmony classes, the circumflex fold, the consonant
 * table + geminating-stop set, clause punctuation, and the number words. The ALGORITHMS that read them stay in
 * code (g2p.ts / turkish.ts / numbers.ts): the scan (palatalization, dark-l, ğ), stress + suffix morphology, and
 * the cardinal compositor. Stress exceptions stay in the sibling stress.tsv, which the manifest only references.
 */

import { loadManifest } from "../../core/loadManifest.ts";

export interface TurkishManifest {
    vowels: {
        ipa: Record<string, string>;
        front: string[];
        frontUnround: string[];
        back: string[];
    };
    circumflexFold: Record<string, string>;
    consonants: Record<string, string>;
    geminate: string[];
    clausePunctuation: Record<string, string>;
    numbers: {
        ones: string[];
        tens: string[];
        scales: string[];
        hundred: string;
        zero: string;
        decimalConnector: string;
    };
    letterNames: Record<string, string>;
    phonotactics: { vowels: string; onsets: string[]; codas: string[] };
}

/** The consolidated hand-authored Turkish data tables (see turkish.jsonc). */
export const MANIFEST = loadManifest<TurkishManifest>(import.meta.url, "turkish.jsonc");

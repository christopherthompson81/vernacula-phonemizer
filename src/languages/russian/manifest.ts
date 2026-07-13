/**
 * Loads the Russian data manifest (russian.jsonc) once at module init and exposes it typed. Holds the context-
 * free hand-authored DATA: the hard/soft consonant table, the letter class sets, the voicing-pair maps + obstruent
 * sets, the regressive-softening dental classes, the genitive-ɡ adverb list, the closed-class irregulars, the
 * adjective-ending → lemma table, clause punctuation, and the number words. The ALGORITHMS that read them stay in
 * code (g2p.ts / russian.ts / numbers.ts): the Cyrillic scan, vowel reduction, voicing assimilation, stress
 * inference, and the number compositor. The lexical stress + hard-е dictionaries stay in sibling .tsv files.
 */

import { loadManifest } from "../../core/loadManifest.ts";

export interface RussianManifest {
    vowelLetters: string;
    consonants: Record<string, [string, string]>;
    alwaysHard: string[];
    alwaysSoft: string[];
    softVowels: string[];
    iotatedVowels: string[];
    devoice: Record<string, string>;
    voice: Record<string, string>;
    voicelessObstruents: string[];
    voicedObstruents: string[];
    softenTargets: string;
    softenTriggers: string;
    genitiveKeepG: string[];
    irregulars: Record<string, string>;
    adjectiveStress: {
        hardLemmas: string[];
        softLemmas: string[];
        endings: { end: string; type: "hard" | "soft" }[];
    };
    clausePunctuation: Record<string, string>;
    numbers: {
        ones: string[];
        tens: string[];
        hundreds: string[];
        million: string[];
        thousand: string[];
        thousandFeminine: { one: string; two: string };
        decimalConnector: string;
    };
}

/** The consolidated hand-authored Russian data tables (see russian.jsonc). */
export const MANIFEST = loadManifest<RussianManifest>(import.meta.url, "russian.jsonc");

/**
 * Loads the Modern Greek data manifest (greek.jsonc) once at module init. Holds the context-free hand-authored
 * DATA (vowel/consonant/digraph tables, palatalisation map, number words); the CONTEXT rules (palatalisation,
 * αυ/ευ + σ voicing, synizesis, double-consonant simplification) live in greek.ts.
 */
import { loadManifest } from "../../core/loadManifest.ts";
import type { CountForms } from "../../core/normalizeSymbols.ts";

export interface GreekManifest {
    /** Accented vowel → its bare letter. ⚠ greek.ts DERIVES the stressed-vowel set from these keys. */
    tonos: Record<string, string>;
    /** ⚠ Synizesis palatalises λ and ν, which `palatal` does not cover; κ/γ/χ come from `palatal`. */
    synizesisPalatal: Record<string, string>;
    homoglyphs: Record<string, string>;
    letterNames: Record<string, string>;
    wordAcronyms: Record<string, string>;
    mixedCaseInitialisms: Record<string, string>;
    ordinals: {
        units: string[];
        /** ⚠ All OXYTONE, which selects the second column of `endings`. */
        tens: string[];
        endings: Record<string, readonly [string, string]>;
    };
    alphabeticNumerals: Record<string, number>;
    /** ⚠ Hours are FEMININE and minutes NEUTER — two series for the same digits. */
    clock: { hoursFeminine: string[]; minuteUnits: string[]; minuteTeens: string[]; minuteTens: string[] };
    /** ⚠ CASE-SENSITIVE: π.Χ. is "before Christ", π.χ. is "for example". */
    abbreviations: Record<string, string>;
    language: string;
    name: string;
    script: readonly string[];
    vowels: Record<string, string>;
    /** Voiceless consonant letters — they take the voiceless glide [ç] under palatalisation. */
    voiceless: readonly string[];
    /** Letters AND digraphs that make ⟨αυ ευ⟩ voiced ([av ev] rather than [af ef]). */
    auVoiced: readonly string[];
    /** The shorter class that voices a preceding ⟨σ⟩ to [z]. */
    sigmaVoiced: readonly string[];
    vowelDigraphs: Record<string, string>;
    consonants: Record<string, string>;
    consonantDigraphs: Record<string, string>;
    palatal: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: {
        units: string[];
        /** 10–19, indexed by the unit. ⚠ Lexical words — `tens[1]` is empty, nothing composes δέκα + unit. */
        teens: string[];
        tens: string[];
        /** εκατόν — 100 BEFORE A REMAINDER. 100 alone is `hundreds[1]` (εκατό). */
        hundred: string;
        hundreds: string[];
        thousand: string;
    };
    /** The shared symbol tier's data — moved verbatim, comments included. See the jsonc. */
    symbolTier: {
        percent: CountForms;
        currency: Record<string, CountForms>;
        units: Record<string, CountForms>;
        magnitudes: string[];
        ampersand: string;
        multiply: { times: string; by?: string };
        exponentWords: { squared: CountForms; cubed: CountForms; position?: "before" | "after" };
    };
}

/** The consolidated hand-authored Modern Greek data tables (see greek.jsonc). */
export const MANIFEST = loadManifest<GreekManifest>(import.meta.url, "greek.jsonc");

/**
 * Loads the Hungarian data manifest (hungarian.jsonc) once at module init and exposes it typed. Holds the
 * hand-authored longest-match orthography→IPA rule table (digraphs + their geminate forms), clause punctuation,
 * and the number words. The ALGORITHMS (the longest-match scan + doubled-consonant gemination + fixed
 * first-syllable stress, the cardinal compositor) stay in code (hungarian.ts / numbers.ts).
 */
import { loadManifest } from "../../core/loadManifest.ts";
import type { CountForms } from "../../core/normalizeSymbols.ts";

export interface HungarianManifest {
    rules: [string, string, boolean][];
    voicelessTriggers: readonly string[];
    voicedTriggers: readonly string[];
    clausePunctuation: Record<string, string>;
    numbers: {
        units: string[];
        teens: string[];
        tens: string[];
        tensPrefix: Record<string, string>;
        hundred: string;
        thousand: string;
        million: string;
        milliard: string;
    };
    letterNames: Record<string, string>;
    phonotactics: { vowels: string; onsets: string[]; codas: string[] };
    /** The shared symbol tier's data — moved verbatim, comments included. See the jsonc. */
    symbolTier: {
        percent: CountForms;
        currency: Record<string, CountForms>;
        units: Record<string, CountForms>;
        rateDenominators: Record<string, string>;
        unitPer: string;
        ampersand: string;
        exponentWords: { squared: CountForms; cubed: CountForms; position?: "before" | "after" };
    };
    /** The ordinal form of each morph that can END a cardinal. See the jsonc. */
    ordinalMorphs: Record<string, string>;
    /** Multiplicative form of each morph that can END a cardinal (-szor/-szer/-ször). */
    multiplicativeMorphs: Record<string, string>;
}

/** The consolidated hand-authored Hungarian data tables (see hungarian.jsonc). */
export const MANIFEST = loadManifest<HungarianManifest>(import.meta.url, "hungarian.jsonc");

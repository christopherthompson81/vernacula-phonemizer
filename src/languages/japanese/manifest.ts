/**
 * Loads the Japanese data manifest (japanese.jsonc) once at module init and exposes it typed. Holds the
 * hand-authored kana→mora tables, the extended-katakana map, the moraic-ん assimilation classes, the Sino-
 * Japanese number words, clause punctuation, and the pitch-accent affix-strip lists. The ALGORITHMS that read
 * them stay in code (kana.ts / numbers.ts / kanji.ts / pitch.ts / japanese.ts); the bulk lexical data stays in
 * sibling .tsv/.txt files (readings/fallback/adverbs/pitch-accent), which the manifest only documents.
 */

import { loadManifest } from "../../core/loadManifest.ts";
import type { CountForms } from "../../core/normalizeSymbols.ts";

export interface JapaneseManifest {
    vowels: Record<string, string>;
    mora: Record<string, string>;
    youonOnset: Record<string, string>;
    smallY: Record<string, string>;
    foreign: Record<string, string>;
    vowelKana: Record<string, string>;
    nasalAssimilation: { onsets: string; nasal: string }[];
    clausePunctuation: Record<string, string>;
    numbers: {
        ones: string[];
        hundreds: string[];
        thousands: string[];
        myriadUnits: string[];
        ten: string;
        zero: string;
    };
    pitchStrip: {
        particles: string;
        copula: string[];
        copulaFinalParticles: string;
    };
    /** The shared symbol tier's data — moved verbatim, comments included. See the jsonc. */
    symbolTier: {
        percent: CountForms;
        currency: Record<string, CountForms>;
        units: Record<string, CountForms>;
        unspacedScript: boolean;
        ampersand: string;
        multiply: { times: string; by?: string };
        exponentWords: { squared: CountForms; cubed: CountForms; position?: "before" | "after" };
        bareExponent: { squared: string; cubed: string; power: string; negative: string };
    };
}

/** The consolidated hand-authored Japanese data tables (see japanese.jsonc). */
export const MANIFEST = loadManifest<JapaneseManifest>(import.meta.url, "japanese.jsonc");

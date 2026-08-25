/**
 * Loads the Mandarin data manifest (cmn.jsonc) once at module init and exposes it typed. Holds the tone system,
 * the third-tone sandhi rule, clause punctuation, the measure-word set, and the number-reading tables. The bulk
 * lexical data stays in sibling .tsv files (syllable-ipa / chars / phrases), loaded separately in mandarin.ts.
 * The ALGORITHMS that read this manifest stay in code (pinyinToIpa.ts / numbers.ts / mandarin.ts): the sandhi
 * scan, the Arabic→Chinese numeral compositor, and the tokenizer.
 */

import { loadManifest } from "../../core/loadManifest.ts";
import type { CountForms } from "../../core/normalizeSymbols.ts";

export interface CmnManifest {
    tones: Record<string, string>;
    sandhi: { thirdThird: { from: string; before: string; to: string } };
    clausePunctuation: Record<string, string>;
    measureWords: string;
    numbers: {
        digits: string[];
        positions: string[];
        bigUnits: string[];
        two: string;
        decimalPoint: string;
        zeroDigit: string;
    };
    /** ⚠ Keyed by UPPERCASE Latin — see the jsonc. */
    letterNames: Record<string, string>;
    /** The shared symbol tier's data — moved verbatim, comments included. See the jsonc. */
    symbolTier: {
        percent: CountForms;
        currency: Record<string, CountForms>;
        units: Record<string, CountForms>;
        magnitudes: string[];
        unspacedScript: boolean;
        percentPrefix: boolean;
        multiply: { times: string; by?: string };
        exponentWords: { squared: CountForms; cubed: CountForms; position?: "before" | "after" };
        bareExponent: { squared: string; cubed: string; power: string; negative: string };
    };
}

/** The consolidated hand-authored Mandarin data tables (see cmn.jsonc). */
export const MANIFEST = loadManifest<CmnManifest>(import.meta.url, "cmn.jsonc");

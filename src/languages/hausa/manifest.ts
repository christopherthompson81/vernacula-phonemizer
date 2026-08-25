/**
 * Loads the Hausa data manifest (hausa.jsonc) once at module init and exposes it typed. The hand-authored DATA
 * (the longest-match orthography→IPA rule table, the tone-code→Chao map, clause punctuation, and the number
 * words) lives in the JSONC; the ALGORITHM (longest-match scan + penultimate stress + tone overlay) stays in
 * g2p.ts / hausa.ts / numbers.ts, and the per-word tone lexicon is a separate file (tone.tsv).
 */

import { loadManifest } from "../../core/loadManifest.ts";
import type { CountForms } from "../../core/normalizeSymbols.ts";

export interface HausaManifest {
    rules: [string, string, boolean][];
    toneChao: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: {
        ones: string[];
        tens: string[];
        teensConnector: string;
        connector: string;
        hundred: string;
        thousand: string;
        million: string;
        billion: string;
    };
    letterNames: Record<string, string>;
    phonotactics: { vowels: string; onsets: string[]; codas: string[] };
    /** The shared symbol tier's data — moved verbatim, comments included. */
    symbolTier: {
        multiply: { times: string; by?: string };
        percentPrefix: boolean;
        percent: CountForms;
        currency: Record<string, CountForms>;
        units: Record<string, CountForms>;
        exponentWords: { squared: CountForms; cubed: CountForms; position?: "before" | "after" };
    };
}

/** The consolidated hand-authored Hausa data tables (see hausa.jsonc). */
export const MANIFEST = loadManifest<HausaManifest>(import.meta.url, "hausa.jsonc");

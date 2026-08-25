/**
 * Loads the Cebuano data manifest (cebuano.jsonc) once at module init and exposes it typed.
 *
 * ⚠ ONE LOAD, MODULE-LEVEL. cebuano.ts declared this shape inline and loaded the file itself, and the symbol
 * tier lives in normalize.ts — importing the shape across would have made the two a cycle. Same reason Māori
 * and Javanese needed one.
 */
import { loadManifest } from "../../core/loadManifest.ts";
import type { CountForms } from "../../core/normalizeSymbols.ts";

export interface CebuanoManifest {
    digraphs: Record<string, string>;
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    specialWords: Record<string, string>;
    clausePunctuation: Record<string, string>;
    /** The shared symbol tier's data — moved verbatim, comments included. See the jsonc. */
    symbols: {
        percent: CountForms;
        currency: Record<string, CountForms>;
        units: Record<string, CountForms>;
        rateDenominators: Record<string, string>;
        unitPer: string;
        magnitudes: string[];
        ampersand: string;
        multiply: { times: string; by?: string };
        exponentWords: { squared: CountForms; cubed: CountForms; position?: "before" | "after" };
    };
}

/** The consolidated hand-authored Cebuano data tables (see cebuano.jsonc). */
export const MANIFEST = loadManifest<CebuanoManifest>(import.meta.url, "cebuano.jsonc");

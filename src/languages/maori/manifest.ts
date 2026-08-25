/**
 * Loads the Māori data manifest (maori.jsonc) once at module init and exposes it typed.
 *
 * ⚠ ONE LOAD, MODULE-LEVEL. maori.ts declared this shape inline and loaded the file itself, and the symbol
 * tier lives in normalize.ts — importing the shape across would have made maori.ts ↔ normalize.ts a cycle.
 */
import { loadManifest } from "../../core/loadManifest.ts";
import type { CountForms } from "../../core/normalizeSymbols.ts";

export interface MaoriManifest {
    digraphs: Record<string, string>;
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
    /** The shared symbol tier's data — moved verbatim, comments included. */
    symbols: {
        percent: CountForms;
        currency: Record<string, CountForms>;
        units: Record<string, CountForms>;
        rateDenominators: Record<string, string>;
        unitPer: string;
        magnitudes: string[];
        multiply: { times: string; by?: string };
        exponentWords: { squared: CountForms; cubed: CountForms; position?: "before" | "after" };
    };
}

/** The consolidated hand-authored Māori data tables (see maori.jsonc). */
export const MANIFEST = loadManifest<MaoriManifest>(import.meta.url, "maori.jsonc");

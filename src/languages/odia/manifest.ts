/**
 * Loads the Odia data manifest (odia.jsonc) once at module init and exposes it typed.
 *
 * ⚠ ONE LOAD, MODULE-LEVEL — the FIFTH language in this sweep to need its own manifest module for the same
 * reason: the symbol tier lives in normalize.ts while `DEF` lived in the engine file, so importing across
 * would have made the two a cycle. it, jv, mi and ceb were the others.
 */
import { loadManifest } from "../../core/loadManifest.ts";
import type { CountForms } from "../../core/normalizeSymbols.ts";
import type { AbugidaDef } from "../../core/abugida.ts";
import type { NumbersDef } from "../../core/numbers.ts";

export interface OdiaManifest extends AbugidaDef {
    numbers: NumbersDef;
    clausePunctuation: Record<string, string>;
    /** The shared symbol tier's data — moved verbatim, comments included. See the jsonc. */
    symbolTier: {
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

/** The consolidated hand-authored Odia data tables (see odia.jsonc). */
export const MANIFEST = loadManifest<OdiaManifest>(import.meta.url, "odia.jsonc");

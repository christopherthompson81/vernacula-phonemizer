/**
 * Loads the Cantonese data manifest (cantonese.jsonc) once at module init and exposes it typed.
 *
 * ⚠ ONE LOAD, MODULE-LEVEL — the SIXTH language in this sweep to need its own manifest module, and always
 * for the same reason: the symbol tier lives in normalize.ts while `DEF` lived in the engine file, so
 * importing across would be a cycle. it, jv, mi, ceb and or were the others.
 */
import { loadManifest } from "../../core/loadManifest.ts";
import type { CountForms } from "../../core/normalizeSymbols.ts";

export interface CantoneseManifest {
    initials: Record<string, string>;
    finals: Record<string, string>;
    tones: Record<string, string>;
    clausePunctuation: Record<string, string>;
    measureWords: string;
    /** The shared symbol tier's data — moved verbatim, comments included. See the jsonc. */
    symbolTier: {
        percent: CountForms;
        currency: Record<string, CountForms>;
        units: Record<string, CountForms>;
        unspacedScript: boolean;
        ampersand: string;
        percentPrefix: boolean;
        multiply: { times: string; by?: string };
        exponentWords: { squared: CountForms; cubed: CountForms; position?: "before" | "after" };
    };
}

/** The consolidated hand-authored Cantonese data tables (see cantonese.jsonc). */
export const MANIFEST = loadManifest<CantoneseManifest>(import.meta.url, "cantonese.jsonc");

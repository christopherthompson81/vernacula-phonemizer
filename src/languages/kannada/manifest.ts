/**
 * Loads the Kannada data manifest (kannada.jsonc) once and exposes it typed. The manifest IS the
 * language data: the abugida definition read by the shared core/abugida.ts G2P, the clause punctuation,
 * and the cardinal number words including the fused 21-99 compounds, the irregular round hundreds and
 * the combining ("oblique") magnitude forms. The ALGORITHMS that read it stay in code — the G2P
 * post-pass (kannada.ts) and the number compositor (numbers.ts).
 *
 * Split out of kannada.ts so numbers.ts and normalize.ts can read the same single load.
 */
import { loadManifest } from "../../core/loadManifest.ts";
import type { CountForms } from "../../core/normalizeSymbols.ts";
import type { AbugidaDef } from "../../core/abugida.ts";
import type { DravidianForms, DravidianNumbersDef } from "../../core/numbers.ts";

/** A magnitude noun's two forms: bare (nothing follows) and combining (a remainder follows).
 *  Now the shared `DravidianForms` — the composer moved to core/numbers.ts (see numbers.ts). */
export type MagnitudeForms = DravidianForms;

/**
 * ⚠ THIS EXTENDS THE DRAVIDIAN DEF, NOT `NumbersDef`, AND THE DIFFERENCE WAS THREE DEAD KEYS. Kannada
 * composes through `dravidianNumberWords`, which reads units/teens/tens/compound/hundredForms/
 * magnitudeForms and nothing else. `NumbersDef` is the shape `indicNumberWords` reads, and extending it
 * made `magnitudes` a REQUIRED key of a manifest no composer would ever consult — so the file carried a
 * second, unread set of magnitude words beside the `magnitudeForms` that are actually read, plus the
 * optional `compoundOrder` and `bareMagnitude`, which `indicNumberWords` alone honours. Sabotaging all
 * three to nonsense moved 0 of 1,211 readings. A required field of an inherited interface is not
 * evidence that anything reads it.
 */
export interface KannadaNumbers extends DravidianNumbersDef {
    compound: Record<string, string>;
    /** Irregular fused round hundreds, keyed by the count of hundreds (1,2,3,5,9 — see numbers.ts). */
    hundredForms: Record<string, MagnitudeForms>;
    magnitudeForms: {
        hundred: MagnitudeForms;
        thousand: MagnitudeForms;
        lakh: MagnitudeForms;
        crore: MagnitudeForms;
    };
    decimalWord: string;
}

export interface KannadaManifest extends AbugidaDef {
    numbers: KannadaNumbers;
    clausePunctuation: Record<string, string>;
    /** ⚠ WRITTEN forms for RECOGNITION, not a spelling map — see the jsonc. Never emitted as a reading. */
    initialismLetterForms: string[];
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

export const MANIFEST = loadManifest<KannadaManifest>(import.meta.url, "kannada.jsonc");

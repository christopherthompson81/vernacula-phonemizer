/**
 * Loads the Telugu data manifest (telugu.jsonc) once and exposes it typed. The manifest IS the language
 * data: the abugida definition read by the shared core/abugida.ts G2P, the clause punctuation, and the
 * cardinal number words including the magnitude-agreement forms. The ALGORITHMS that read it stay in
 * code — the G2P post-pass (telugu.ts) and the number compositor (numbers.ts).
 *
 * Split out of telugu.ts so numbers.ts and normalize.ts can read the same single load.
 */
import { loadManifest } from "../../core/loadManifest.ts";
import type { AbugidaDef } from "../../core/abugida.ts";
import type { DravidianForms, NumbersDef } from "../../core/numbers.ts";

/** The four forms a Telugu magnitude noun takes; see the `magnitudeForms` note in telugu.jsonc.
 *  Telugu is the consumer that needs all four slots of the shared `DravidianForms`. */
export type MagnitudeForms = Required<DravidianForms>;

export interface TeluguNumbers extends NumbersDef {
    teens: string[];
    magnitudeForms: {
        hundred: MagnitudeForms;
        thousand: MagnitudeForms;
        lakh: MagnitudeForms;
        crore: MagnitudeForms;
    };
}

export interface TeluguManifest extends AbugidaDef {
    numbers: TeluguNumbers;
    clausePunctuation: Record<string, string>;
    /** ⚠ WRITTEN forms for RECOGNITION, not a spelling map — see the jsonc. Never emitted as a reading. */
    initialismLetterForms: string[];
}

export const MANIFEST = loadManifest<TeluguManifest>(import.meta.url, "telugu.jsonc");

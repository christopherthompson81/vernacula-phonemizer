/**
 * Loads the Malayalam data manifest (malayalam.jsonc) once and exposes it typed. The manifest IS the
 * language data: the abugida definition read by the shared core/abugida.ts G2P, the clause punctuation,
 * and the cardinal number words including the fused 21-99 compounds, the suppletive round hundreds and
 * thousands, and the combining ("oblique") magnitude forms. The ALGORITHMS that read it stay in code —
 * the G2P post-pass (malayalam.ts), the shared Dravidian compositor (core/numbers.ts) and the Malayalam
 * ordinal/oblique morphology (numbers.ts).
 *
 * Split out of malayalam.ts so numbers.ts and normalize.ts can read the same single load.
 */
import { loadManifest } from "../../core/loadManifest.ts";
import type { AbugidaDef } from "../../core/abugida.ts";
import type { DravidianNumbersDef } from "../../core/numbers.ts";

/**
 * ⚠ THE DRAVIDIAN DEF ALONE. This used to extend `NumbersDef` as well, which made `magnitudes` a
 * REQUIRED key — a second, unread set of magnitude words beside the `magnitudeForms` the composer
 * actually reads — and invited the optional `compoundOrder`/`bareMagnitude` that only `indicNumberWords`
 * honours. Malayalam never calls that composer. Sabotaging all three moved 0 of 1,229 readings.
 */
export interface MalayalamNumbers extends DravidianNumbersDef {
    compound: Record<string, string>;
    decimalWord: string;
}

export interface MalayalamManifest extends AbugidaDef {
    numbers: MalayalamNumbers;
    clausePunctuation: Record<string, string>;
}

export const MANIFEST = loadManifest<MalayalamManifest>(import.meta.url, "malayalam.jsonc");

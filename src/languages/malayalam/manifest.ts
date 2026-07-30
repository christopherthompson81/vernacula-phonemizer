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
import type { DravidianNumbersDef, NumbersDef } from "../../core/numbers.ts";

export interface MalayalamNumbers extends NumbersDef, DravidianNumbersDef {
    teens: string[];
    compound: Record<string, string>;
    decimalWord: string;
}

export interface MalayalamManifest extends AbugidaDef {
    numbers: MalayalamNumbers;
    clausePunctuation: Record<string, string>;
}

export const MANIFEST = loadManifest<MalayalamManifest>(import.meta.url, "malayalam.jsonc");

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
import type { AbugidaDef } from "../../core/abugida.ts";
import type { NumbersDef } from "../../core/numbers.ts";

/** A magnitude noun's two forms: bare (nothing follows) and combining (a remainder follows). */
export interface MagnitudeForms {
    bare: string;
    combining: string;
}

export interface KannadaNumbers extends NumbersDef {
    teens: string[];
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
}

export const MANIFEST = loadManifest<KannadaManifest>(import.meta.url, "kannada.jsonc");

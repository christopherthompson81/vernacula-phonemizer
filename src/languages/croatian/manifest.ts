/**
 * Loads the Croatian data manifest (croatian.jsonc). Croatian reuses the Serbo-Croatian SEGMENTAL g2p from the
 * Serbian module (croatian.ts imports phonemizeWord); this manifest holds only the Croatian-specific delta — the
 * cardinal number-word table (tisuća/milijun/dvjesto) — plus clause punctuation.
 */
import { loadManifest } from "../../core/loadManifest.ts";
import type { MANIFEST as SR } from "../serbian/manifest.ts";

export interface CroatianManifest {
    language: string;
    name: string;
    script: string;
    numbers: (typeof SR)["numbers"]; // same shape as the Serbian number table (Croatian word forms)
    clausePunctuation: Record<string, string>;
}

/** The consolidated hand-authored Croatian data tables (see croatian.jsonc). */
export const MANIFEST = loadManifest<CroatianManifest>(import.meta.url, "croatian.jsonc");

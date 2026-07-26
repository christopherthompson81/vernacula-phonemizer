/**
 * Loads the Bosnian data manifest (bosnian.jsonc). Bosnian reuses the Serbo-Croatian SEGMENTAL g2p from the Serbian
 * module (bosnian.ts imports phonemizeWord); this manifest holds only the Bosnian-specific delta — the cardinal
 * number-word table (Serbian hiljada/milion lexemes + the ijekavian dvjesta) — plus clause punctuation.
 */
import { loadManifest } from "../../core/loadManifest.ts";
import type { MANIFEST as SR } from "../serbian/manifest.ts";

export interface BosnianManifest {
    language: string;
    name: string;
    script: string;
    numbers: (typeof SR)["numbers"]; // same shape as the Serbian number table (Bosnian word forms)
    clausePunctuation: Record<string, string>;
}

/** The consolidated hand-authored Bosnian data tables (see bosnian.jsonc). */
export const MANIFEST = loadManifest<BosnianManifest>(import.meta.url, "bosnian.jsonc");

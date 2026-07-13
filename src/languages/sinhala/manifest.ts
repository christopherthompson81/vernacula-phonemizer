/**
 * Loads the Sinhala data manifest (sinhala.jsonc) once at module init and exposes it typed. The manifest IS the
 * language data: the abugida definition (consonants / vowels / signs — read by the shared core/abugida.ts G2P),
 * plus the Sinhala-specific post-pass DATA (the homorganic anusvara classes, clause punctuation, and the cardinal
 * number words). The ALGORITHMS that read it stay in code (sinhala.ts / numbers.ts): the anusvara rewrite, the
 * geminate / schwa / stress post-passes, and the number compositor.
 */

import { loadManifest } from "../../core/loadManifest.ts";
import type { AbugidaDef } from "../../core/abugida.ts";

export interface SinhalaManifest extends AbugidaDef {
    anusvara: {
        default: string;
        classes: { triggers: string; nasal: string; note?: string }[];
    };
    clausePunctuation: Record<string, string>;
    numbers: {
        units: string[];
        teens: string[];
        tensWord: Record<string, string>;
        tensStem: Record<string, string>;
        magnitudes: {
            hundred: string;
            thousand: string;
            lakh: string;
            million: string;
        };
    };
}

/** The consolidated Sinhala data (abugida def + post-pass tables; see sinhala.jsonc). */
export const MANIFEST = loadManifest<SinhalaManifest>(import.meta.url, "sinhala.jsonc");

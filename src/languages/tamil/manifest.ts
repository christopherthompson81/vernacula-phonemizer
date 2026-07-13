/**
 * Loads the Tamil data manifest (tamil.jsonc) once at module init and exposes it typed. The manifest IS the
 * language data: the abugida definition (consonants / vowels / signs — read by the shared core/abugida.ts G2P),
 * plus the Tamil-specific post-pass DATA (the Dravidian voicing classes, clause punctuation, and the cardinal
 * number words). The ALGORITHMS that read it stay in code (tamil.ts / numbers.ts): the IPA-unit segmenter, the
 * context-sensitive voicing allophony, the two-level stress pass, and the number compositor.
 */

import { loadManifest } from "../../core/loadManifest.ts";
import type { AbugidaDef } from "../../core/abugida.ts";

export interface TamilManifest extends AbugidaDef {
    voicing: {
        voice: Record<string, string>;
        nasals: string[];
        voicelessBlock: string[];
    };
    clausePunctuation: Record<string, string>;
    numbers: {
        units: string[];
        tens: string[];
        magnitudes: {
            hundred: string;
            thousand: string;
            lakh: string;
            crore: string;
        };
    };
}

/** The consolidated Tamil data (abugida def + post-pass tables; see tamil.jsonc). */
export const MANIFEST = loadManifest<TamilManifest>(import.meta.url, "tamil.jsonc");

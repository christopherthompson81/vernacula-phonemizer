/**
 * Loads the Tamil data manifest (tamil.jsonc) once at module init and exposes it typed. The manifest IS the
 * language data: the abugida definition (consonants / vowels / signs — read by the shared core/abugida.ts G2P),
 * plus the Tamil-specific post-pass DATA (the Dravidian voicing classes, clause punctuation, and the cardinal
 * number words). The ALGORITHMS that read it stay in code (tamil.ts / numbers.ts): the IPA-unit segmenter, the
 * context-sensitive voicing allophony, the two-level stress pass, and the number compositor.
 */

import { loadManifest } from "../../core/loadManifest.ts";
import type { AbugidaDef } from "../../core/abugida.ts";

/**
 * The Tamil cardinal tables. Tamil numerals are SANDHI-FUSED, so every level needs two forms: the free
 * form (exact multiple — இருபது, நூறு, ஆயிரம்) and the COMBINING/oblique form used when a remainder
 * follows it (இருபத்தி, நூற்றி, ஆயிரத்து). 11–19 are suppletive and listed outright.
 */
export interface TamilNumbers {
    units: string[];
    tens: string[];
    teens: string[];
    tensCombining: string[];
    hundreds: string[];
    hundredsCombining: string[];
    thousands: string[];
    thousandsCombining: string[];
    magnitudes: {
        hundred: string;
        thousand: string;
        thousandCombining: string;
        lakh: string;
        lakhCombining: string;
        crore: string;
        croreCombining: string;
        one: string;
    };
}

export interface TamilManifest extends AbugidaDef {
    voicing: {
        voice: Record<string, string>;
        nasals: string[];
        voicelessBlock: string[];
    };
    clausePunctuation: Record<string, string>;
    numbers: TamilNumbers;
    /** ⚠ WRITTEN forms for RECOGNITION, not a spelling map — see the jsonc. Never emitted as a reading. */
    initialismLetterForms: string[];
}

/** The consolidated Tamil data (abugida def + post-pass tables; see tamil.jsonc). */
export const MANIFEST = loadManifest<TamilManifest>(import.meta.url, "tamil.jsonc");

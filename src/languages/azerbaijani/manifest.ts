/**
 * Loads the Azerbaijani data manifest (azerbaijani.jsonc) once at module init and exposes it typed. Holds the
 * context-free hand-authored DATA: the vowel letter→IPA table + harmony classes, the consonant table + geminating
 * set, clause punctuation, and the number words. The ALGORITHMS that read them stay in code (g2p.ts /
 * azerbaijani.ts / numbers.ts): the scan (palatalization, dark-l, ğ→ɣ, q-devoicing), final-syllable stress, and
 * the cardinal compositor.
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface AzerbaijaniManifest {
    vowels: {
        ipa: Record<string, string>;
        front: string[];
        back: string[];
    };
    consonants: Record<string, string>;
    geminate: string[];
    clausePunctuation: Record<string, string>;
    numbers: {
        ones: string[];
        tens: string[];
        scales: string[];
        hundred: string;
        zero: string;
        decimalConnector: string;
    };
}

/** The consolidated hand-authored Azerbaijani data tables (see azerbaijani.jsonc). */
export const MANIFEST = loadManifest<AzerbaijaniManifest>(import.meta.url, "azerbaijani.jsonc");

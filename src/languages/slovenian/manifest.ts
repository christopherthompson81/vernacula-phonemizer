/**
 * Loads the Slovenian data manifest (slovenian.jsonc) once at module init and exposes it typed. Holds the context-
 * free hand-authored DATA: the vowel + consonant tables, the voicing-assimilation pairs, clause punctuation, and the
 * number words. The ALGORITHMS that read them stay in code (g2p.ts / slovenian.ts / numbers.ts): the scan,
 * l-vocalization, lj/nj resolution, syllabic-r, voicing/devoicing, the tokenizer, and the cardinal compositor.
 */

import { loadManifest } from "../../core/loadManifest.ts";

export interface SlovenianManifest {
    vowels: Record<string, string>;
    consonants: Record<string, string>;
    voicing: {
        toVoiceless: Record<string, string>;
        toVoiced: Record<string, string>;
    };
    clausePunctuation: Record<string, string>;
    numbers: {
        units: string[];
        teens: string[];
        tens: string[];
        hundreds: string[];
        and: string;
        thousand: string;
        countForms: Record<"m" | "f", Record<string, string>>;
        magnitudes: {
            million: { gender: "m" | "f"; sg: string; dual: string; paucal: string; plural: string };
            milliard: { gender: "m" | "f"; sg: string; dual: string; paucal: string; plural: string };
        };
    };
}

/** The consolidated hand-authored Slovenian data tables (see slovenian.jsonc). */
export const MANIFEST = loadManifest<SlovenianManifest>(import.meta.url, "slovenian.jsonc");

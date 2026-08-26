/**
 * Loads the consolidated Czech data manifest (czech.jsonc) once at module init and exposes it typed. The
 * hand-authored DATA tables (vowel + consonant maps, palatalisation table, voicing-assimilation pairs, clause
 * punctuation, number words) live in the JSONC; the ALGORITHMS that consume them stay in the sibling modules
 * (g2p.ts, numbers.ts, czech.ts).
 */

import { loadManifest } from "../../core/loadManifest.ts";

interface Agreement {
    sg: string;
    paucal: string;
    plural: string;
}

export interface CzechManifest {
    vowels: Record<string, string>;
    palatalisation: { map: Record<string, string>; triggers: string[] };
    consonants: Record<string, string>;
    voicing: {
        toVoiceless: Record<string, string>;
        toVoiced: Record<string, string>;
    };
    clausePunctuation: Record<string, string>;
    acronymLetters: string[];
    numbers: {
        units: string[];
        teens: string[];
        tens: string[];
        hundreds: string[];
        magnitudes: { thousand: Agreement; million: Agreement; billion: Agreement };
    };
}

/** The consolidated hand-authored Czech data tables (see czech.jsonc). */
export const MANIFEST = loadManifest<CzechManifest>(import.meta.url, "czech.jsonc");

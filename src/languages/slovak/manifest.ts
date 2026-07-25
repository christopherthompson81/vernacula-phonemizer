/**
 * Loads the consolidated Slovak data manifest (slovak.jsonc) once at module init and exposes it typed. The
 * hand-authored DATA (vowel + consonant maps, palatalisation table, voicing-assimilation pairs, clause punctuation,
 * number words) lives in the JSONC; the ALGORITHMS that consume them stay in the sibling modules (g2p.ts,
 * numbers.ts, slovak.ts).
 */
import { loadManifest } from "../../core/loadManifest.ts";

interface Agreement {
    sg: string;
    paucal: string;
    plural: string;
}

export interface SlovakManifest {
    vowels: Record<string, string>;
    palatalisation: { map: Record<string, string>; triggers: string[] };
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
        magnitudes: { thousand: Agreement; million: Agreement };
    };
}

/** The consolidated hand-authored Slovak data tables (see slovak.jsonc). */
export const MANIFEST = loadManifest<SlovakManifest>(import.meta.url, "slovak.jsonc");

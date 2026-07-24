/**
 * Loads the Dutch data manifest (dutch.jsonc) once at module init and exposes it typed. The hand-authored DATA
 * tables (vowel length maps, final-devoicing pairs, clause punctuation, number words) live in the JSONC; the
 * ALGORITHMS that consume them stay in the sibling modules (g2p.ts, dutch.ts, numbers.ts).
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface DutchManifest {
    vowelChars: string;
    vowels: {
        long: Record<string, string>;
        short: Record<string, string>;
    };
    consonants: Record<string, string>;
    voicedFinal: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: {
        ones: string[];
        tens: string[];
        connector: string;
        hundred: string;
        thousand: string;
        million: { sg: string; pl: string };
        milliard: { sg: string; pl: string };
    };
    morphology: {
        prefixUnstressed: string[];
        prefixStressed: string[];
        ambiguousPrefixes: string[];
        suffixes: string[];
        vowelInitialSuffixes: string[];
        linkingElements: string[];
        validOnsets: string[];
        stKeep: string[];
    };
}

/** The consolidated hand-authored Dutch data tables (see dutch.jsonc). */
export const MANIFEST = loadManifest<DutchManifest>(import.meta.url, "dutch.jsonc");

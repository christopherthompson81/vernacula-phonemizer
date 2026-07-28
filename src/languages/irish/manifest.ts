/**
 * Loads the Irish data manifest (irish.jsonc) once at module init and exposes it typed. The hand-authored DATA
 * (broad/slender consonant maps, lenition digraphs, vowel-cluster lookup, slender/broad vowel sets, clause
 * punctuation, number words) lives in the JSONC; the ALGORITHMS (g2p.ts, irish.ts, numbers.ts) read it.
 */

import { loadManifest } from "../../core/loadManifest.ts";

export interface IrishManifest {
    slenderVowels: string;
    broadVowels: string;
    broad: Record<string, string>;
    slender: Record<string, string>;
    lenition: Record<string, [string, string]>;
    vowels: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: {
        ones: string[];
        attributive: string[];
        tens: Record<string, string>;
        teenWord: string;
        magnitudes: { hundred: string; thousand: string; million: string; billion: string };
    };
}

/** The consolidated hand-authored Irish data tables (see irish.jsonc). */
export const MANIFEST = loadManifest<IrishManifest>(import.meta.url, "irish.jsonc");

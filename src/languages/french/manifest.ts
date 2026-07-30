/**
 * Loads the French data manifest (french.jsonc) once at module init and exposes it typed. The hand-authored
 * DATA tables (vowel-letter inventory, oral/nasal vowel-multigraph tables, yod groups, sounded-final set, clause
 * punctuation, liaison + h-aspiré lists, number words) live in the JSONC; the ALGORITHMS that consume them stay
 * in the sibling modules (g2p.ts, french.ts, numbers.ts).
 */

import { loadManifest } from "../../core/loadManifest.ts";

export interface FrenchManifest {
    vowelLetters: string;
    vowelPhonemes: string;
    vowelGroups: [string, string][];
    nasalGroups: [string, string][];
    finalSounded: string[];
    yodDouble: [string, string][];
    yodFinal: [string, string][];
    clausePunctuation: Record<string, string>;
    liaison: Record<string, string>;
    /** One spelling → its Lexique reading plus the context-selected alternates. See french.jsonc. */
    heteronyms: Record<string, {
        default: string;
        cases: Array<{ ipa: string; prev?: string[]; next?: string[]; nextIsNumber?: boolean }>;
    }>;
    acronymLetters: string[];
    hAspire: string[];
    numbers: {
        small: string[];
        tens: string[];
        magnitudes: {
            sixty: string;
            eighty: string;
            hundred: string;
            thousand: string;
            million: string;
            millions: string;
        };
        decimalSeparator: string;
    };
}

/** The consolidated hand-authored French data tables (see french.jsonc). */
export const MANIFEST = loadManifest<FrenchManifest>(import.meta.url, "french.jsonc");

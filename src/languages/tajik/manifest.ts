/**
 * Loads the Tajik data manifest (tajik.jsonc) once at module init and exposes it typed.
 *
 * ⚠ IT IS ITS OWN MODULE BECAUSE `tajik.ts` AND `normalize.ts` BOTH NEED IT. The engine imports the
 * normalizer (to run it inside `text()`) and the normalizer needs the manifest's letter names and month
 * names at module init — re-exporting the manifest from `tajik.ts` made that a cycle, and it failed at
 * import time with "Cannot access 'MANIFEST' before initialization" rather than at any gate. Same shape as
 * `russian/manifest.ts`, and for the same reason.
 *
 * Holds the context-free hand-authored DATA: the vowel/glide/consonant → IPA tables, the cardinal number
 * atoms and their scale ladder, the izofat month names, the Cyrillic letter-name table for initialisms, and
 * clause punctuation. The ALGORITHMS that read them stay in code (`tajik.ts`'s grapheme scan, final stress
 * and number compositor; `normalize.ts`'s rules).
 */

import { loadManifest } from "../../core/loadManifest.ts";

export interface TajikManifest {
    vowels: Record<string, string>;
    glides: Record<string, string>;
    consonants: Record<string, string>;
    numbers: {
        units: string[];
        teens: string[];
        tens: Record<string, string>;
        hundred: string;
        thousand: string;
        million: string;
        milliard: string;
        trillion: string;
        and: string;
    };
    /** Month names in the IZOFAT form the corpus writes (`16 ноябри соли 1992`), for the dotted-date rule. */
    months: string[];
    /** Tajik Cyrillic letter → its spoken NAME, for core/initialisms.ts. */
    letterNames: Record<string, string>;
    /** Acronyms read letter-by-letter although phonotactics would pass them as words. */
    acronymLetters: string[];
    clausePunctuation: Record<string, string>;
    phonotactics: { vowels: string; onsets: string[]; codas: string[] };
}

/** The consolidated hand-authored Tajik data tables (see tajik.jsonc). */
export const MANIFEST = loadManifest<TajikManifest>(import.meta.url, "tajik.jsonc");

/**
 * Loads the Kyrgyz data manifest (kyrgyz.jsonc) once at module init and exposes it typed.
 *
 * ⚠ IT IS ITS OWN MODULE BECAUSE `kyrgyz.ts` AND `normalize.ts` BOTH NEED IT. The engine imports the
 * normalizer (to run it inside `text()`) and the normalizer needs the manifest's letter names and number
 * atoms at module init — re-exporting the manifest from `kyrgyz.ts` makes that a cycle, and it fails at
 * import time with "Cannot access 'MANIFEST' before initialization" rather than at any gate. Same shape as
 * `tajik/manifest.ts` and `russian/manifest.ts`, and for the same reason.
 *
 * Holds the hand-authored DATA: the vowel/iotated/consonant → IPA tables, the cardinal number atoms, the
 * Cyrillic letter-name table for initialisms and clause punctuation. The ALGORITHMS that read them stay in
 * code (`kyrgyz.ts`'s harmony scan and number compositor; `normalize.ts`'s rules and suffix morphology).
 */
import { loadManifest } from "../../core/loadManifest.ts";
import type { NumbersDef } from "../../core/numbers.ts";

export interface KyrgyzManifest {
    vowels: Record<string, string>;
    backVowels: string;
    iotated: Record<string, string>;
    consonants: Record<string, string>;
    /** canonical schema: units[], tens{"10".."90"}, magnitudes{hundred,thousand,million,billion} */
    numbers: NumbersDef;
    clausePunctuation: Record<string, string>;
    letterNames: Record<string, string>;
    acronymLetters: string[];
}

export const MANIFEST = loadManifest<KyrgyzManifest>(import.meta.url, "kyrgyz.jsonc");

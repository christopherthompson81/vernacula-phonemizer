/**
 * Loads the Fula data manifest (fula.jsonc) once at module init and exposes it typed. The hand-authored DATA
 * (the longest-match orthography→IPA rule table and the clause punctuation) lives in the JSONC; the ALGORITHM
 * (the longest-match scan + penultimate stress) stays in g2p.ts / fula.ts.
 */

import { loadManifest } from "../../core/loadManifest.ts";

export interface FulaManifest {
    rules: [string, string, boolean][];
    /** The LATIN spelling vowels the Adlam lengthener doubles; not IPA. */
    latinVowels: readonly string[];
    clausePunctuation: Record<string, string>;
}

/** The consolidated hand-authored Fula data tables (see fula.jsonc). */
export const MANIFEST = loadManifest<FulaManifest>(import.meta.url, "fula.jsonc");

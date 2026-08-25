/**
 * Loads the Zulu data manifest (zulu.jsonc) once at module init and exposes it typed. Holds the hand-authored
 * longest-match orthography→IPA rule table, the tone-code→Chao map, clause punctuation, and the number words.
 * The ALGORITHMS that read them stay in code (g2p.ts / zulu.ts / numbers.ts): the longest-match scan, Nguni
 * penultimate stress + lengthening, the compound split + tone overlay, and the cardinal compositor. The per-word
 * tone lexicon stays in the sibling tone.tsv, which the manifest only references.
 */

import { loadManifest } from "../../core/loadManifest.ts";

interface NounClassMagnitude {
    one: string;
    many: string;
}

export interface ZuluManifest {
    rules: [string, string, boolean][];
    toneChao: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: {
        ku: string[];
        na: string[];
        ama: string[];
        zero: string;
        ten: NounClassMagnitude;
        hundred: NounClassMagnitude;
        thousand: NounClassMagnitude;
        million: NounClassMagnitude;
    };
    /** The `ye-` ordinal series. */
    ordinalYe: Record<string, string>;
}

/** The consolidated hand-authored Zulu data tables (see zulu.jsonc). */
export const MANIFEST = loadManifest<ZuluManifest>(import.meta.url, "zulu.jsonc");

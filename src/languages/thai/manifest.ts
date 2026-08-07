/**
 * Loads the Thai data manifest (thai.jsonc) once at module init and exposes it typed. Holds the context-free
 * hand-authored DATA: the onset / coda / vowel-quality grapheme→IPA tables, the vowel-length exception sets, the
 * full tone system (consonant class × mark × life/length → tone → Chao letters), and clause punctuation. The
 * ALGORITHMS that read them stay in code (syllabifier.ts / thaiTone.ts / g2p.ts / segment.ts): the orthographic
 * parser, the tone-computation functions, the IPA renderer, and word segmentation. The bulk lexica stay as
 * sibling files (dictionary.tsv, seg-words.txt), which the manifest only references.
 */

import { loadManifest } from "../../core/loadManifest.ts";
import type { ThaiConsonantClass, ThaiTone, ThaiToneMark } from "./thaiTone.ts";

export interface ThaiManifest {
    onset: Record<string, string>;
    coda: Record<string, string>;
    vowelQuality: Record<string, string>;
    noLength: string[];
    forceLong: string[];
    raisable: string;
    /** Standalone one-grapheme vowel signs (⟨ำ⟩ excluded — it is a glide-bearing span). */
    vowelSigns: readonly string[];
    /** Signs before which ⟨อ⟩ is the glottal-stop consonant rather than the vowel [ɔː]. */
    oGlottalNext: readonly string[];
    /** The short vowel signs — length feeds the dead-short/dead-long tone split. */
    shortVowelSigns: readonly string[];
    /** Sonorant (and glide) codas that make a syllable LIVE. */
    liveCodas: readonly string[];
    tone: {
        class: Record<string, ThaiConsonantClass>;
        fromMark: Record<ThaiToneMark, Record<ThaiConsonantClass, ThaiTone>>;
        noMark: Record<string, Record<ThaiConsonantClass, ThaiTone>>;
        ipa: Record<ThaiTone, string>;
    };
    clausePunctuation: Record<string, string>;
    tcc: string[];
}

/** The consolidated hand-authored Thai data tables (see thai.jsonc). */
export const MANIFEST = loadManifest<ThaiManifest>(import.meta.url, "thai.jsonc");

/** Thai Character Cluster matcher — one inseparable cluster at the START of a string. Compiled once from the
 *  ordered `tcc` pattern list (see thai.jsonc); `segment.ts` uses it to constrain word boundaries. */
export const THAI_TCC_RE = new RegExp(
    "^(?:" + MANIFEST.tcc.join("|") + ")",
    "u",
);

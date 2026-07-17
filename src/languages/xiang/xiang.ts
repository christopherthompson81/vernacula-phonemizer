/**
 * Xiang Chinese / 湘语 (hsn), Changsha 长沙 (New Xiang) dialect — canonical IPA. The seventh Sinitic language (after
 * Mandarin, Cantonese, Wu, Min Nan, Jin, and Hakka). Xiang is a distinct primary branch of Sinitic; Changsha is
 * its prestige/representative variety. Its signature within the Sinitic set: it retains the Middle Chinese 入声
 * (entering) TONE CATEGORY (Chao 24) but has LOST the checked stop coda entirely — no -p̚/-t̚/-k̚ (which Hakka
 * keeps) and no glottal -ʔ (which Jin keeps). Six citation tones: 陰平 ˧˧ (33), 陽平 ˩˧ (13), 上 ˦˩ (41), 陰去 ˦˥
 * (45), 陽去 ˨˩ (21), 入 ˨˦ (24).
 *
 * Written in Han characters. The reading dict (dict.tsv) already carries the Sinological IPA per syllable
 * (segmental IPA + a superscript pitch-number tone, with the narrow Changsha vowel diacritics kept verbatim), so
 * the front-end is the shared Han-dict engine (hanDictIpa.ts): greedy longest-match segmentation, superscript-tone
 * → Chao contour letters (SURFACE tone after a sandhi arrow ⁻), Han numerals. SINGLE authoritative source
 * (Wiktionary/kaikki Changsha Sinological-IPA), no independent referee → 🔷. See docs/hsn_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { createHanDictPhonemizer, type ForeignPhonemizer, type HanDictDef, phonemizeHanWord } from "../sinitic/hanDictIpa.ts";

const DEF = loadManifest<HanDictDef>(import.meta.url, "xiang.jsonc");

let DICT: Map<string, string> | undefined;
function dict(): Map<string, string> {
    return (DICT ??= loadTsvMap(import.meta.url, "dict.tsv"));
}

/** Build the Xiang Chinese phonemizer. `foreign` handles embedded Latin runs. */
export function createXiang(foreign?: ForeignPhonemizer): Phonemizer {
    return createHanDictPhonemizer(dict, DEF, foreign);
}

/** Bare word→IPA (tests / eval): a Han run → IPA. */
export function phonemizeWord(word: string): string {
    return phonemizeHanWord(dict, DEF, word);
}

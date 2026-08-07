/**
 * Gan Chinese / 贛語 (gan), Nanchang 南昌 dialect — canonical IPA. The eighth Sinitic language (after Mandarin,
 * Cantonese, Wu, Min Nan, Jin, Hakka, and Xiang). Gan is a distinct primary branch of Sinitic spoken mainly in
 * Jiangxi; Nanchang (the provincial capital) is its prestige/representative variety — the Taiyuan-for-Jin /
 * Changsha-for-Xiang analogue.
 *
 * Written in Han characters. The reading dict (dict.tsv) already carries the Sinological IPA per syllable
 * (segmental IPA + a superscript pitch-number tone, narrow Nanchang diacritics kept verbatim), so the front-end is
 * the shared Han-dict engine (hanDictIpa.ts): greedy longest-match segmentation, superscript-tone → Chao contour
 * letters (SURFACE tone after a sandhi arrow ⁻), Han numerals. SINGLE authoritative source (Wiktionary/kaikki
 * Nanchang Sinological-IPA). ⚠ SINGLE-SOURCE: there is no independent referee, so nothing here is
 * cross-checked against a second transcription.
 */
import type { Phonemizer } from "../../registry.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { createHanDictPhonemizer, type ForeignPhonemizer, type HanDictDef, phonemizeHanWord } from "../sinitic/hanDictIpa.ts";

const DEF = loadManifest<HanDictDef>(import.meta.url, "gan.jsonc");

let DICT: Map<string, string> | undefined;
function dict(): Map<string, string> {
    return (DICT ??= loadTsvMap(import.meta.url, "dict.tsv"));
}

/** Build the Gan Chinese phonemizer. `foreign` handles embedded Latin runs. */
export function createGan(foreign?: ForeignPhonemizer): Phonemizer {
    return createHanDictPhonemizer(dict, DEF, foreign);
}

/** Bare word→IPA (tests / eval): a Han run → IPA. */
export function phonemizeWord(word: string): string {
    return phonemizeHanWord(dict, DEF, word);
}

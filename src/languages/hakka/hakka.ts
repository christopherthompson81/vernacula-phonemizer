/**
 * Hakka Chinese / 客家话 (hak), Meixian 梅县 (Moiyen) dialect — canonical IPA. The sixth Sinitic language (after
 * Mandarin, Cantonese, Wu, Min Nan, and Jin). Hakka is a distinct primary branch of Sinitic; Meixian is its
 * traditional prestige/representative variety. Its signature is the retention of ALL THREE Middle Chinese stop
 * codas -p̚ -t̚ -k̚ (十→səp̚⁵, 月→ŋiat̚⁵, 六→liʊk̚¹, 客→hak̚¹) — where Jin merged them to a glottal -ʔ and Mandarin
 * lost them entirely. Six citation tones: 陰平 ˦˦ (44), 陽平 ˩˩ (11), 上 ˧˩ (31), 去 ˥˧ (53), 陰入 ˩ (1, checked),
 * 陽入 ˥ (5, checked).
 *
 * Written in Han characters. The reading dict (dict.tsv) already carries the Sinological IPA per syllable
 * (segmental IPA + a superscript pitch-number tone), so the front-end is the shared Han-dict engine
 * (hanDictIpa.ts): greedy longest-match segmentation, superscript-tone → Chao contour letters (SURFACE tone after
 * a sandhi arrow ⁻), Han numerals. SINGLE authoritative source (Wiktionary/kaikki Meixian Sinological-IPA), no
 * independent referee. ⚠ SINGLE-SOURCE: nothing here is cross-checked against a second transcription.
 */
import type { Phonemizer } from "../../registry.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { createHanDictPhonemizer, type ForeignPhonemizer, type HanDictDef, phonemizeHanWord } from "../sinitic/hanDictIpa.ts";

const DEF = loadManifest<HanDictDef>(import.meta.url, "hakka.jsonc");

let DICT: Map<string, string> | undefined;
function dict(): Map<string, string> {
    return (DICT ??= loadTsvMap(import.meta.url, "dict.tsv"));
}

/** Build the Hakka Chinese phonemizer. `foreign` handles embedded Latin runs. */
export function createHakka(foreign?: ForeignPhonemizer): Phonemizer {
    return createHanDictPhonemizer(dict, DEF, foreign);
}

/** Bare word→IPA (tests / eval): a Han run → IPA. */
export function phonemizeWord(word: string): string {
    return phonemizeHanWord(dict, DEF, word);
}

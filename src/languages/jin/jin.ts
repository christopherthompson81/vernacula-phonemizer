/**
 * Jin Chinese / 晋语 (cjy), Taiyuan 太原 dialect — canonical IPA. The fifth Sinitic language (after Mandarin,
 * Cantonese, Wu, and Min Nan). Jin is treated as a primary branch of Sinitic, distinguished from Mandarin by its
 * retention of the Middle Chinese 入声 (checked/entering tone) as a glottal-stop coda -ʔ (月→yəʔ, 十→səʔ) and by
 * rich tone sandhi. Taiyuan has a five-tone citation system: 平 ˩˩ (11), 上 ˥˧ (53), 去 ˦˥ (45), 阴入 ˨ (2,
 * checked), 阳入 ˥˦ (54, checked).
 *
 * Written in Han characters. The reading dict (dict.tsv) already carries the Sinological IPA per syllable
 * (segmental IPA + a superscript pitch-number tone), so the front-end is the shared Han-dict engine
 * (hanDictIpa.ts): greedy longest-match segmentation, superscript-tone → Chao contour letters (taking the
 * SURFACE tone after a sandhi arrow ⁻), Han numerals. SINGLE authoritative source (Wiktionary/kaikki Taiyuan
 * Sinological-IPA), no independent referee → 🔷. See docs/investigations/jin_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { createHanDictPhonemizer, type ForeignPhonemizer, type HanDictDef, phonemizeHanWord } from "../sinitic/hanDictIpa.ts";

const DEF = loadManifest<HanDictDef>(import.meta.url, "jin.jsonc");

let DICT: Map<string, string> | undefined;
function dict(): Map<string, string> {
    return (DICT ??= loadTsvMap(import.meta.url, "dict.tsv"));
}

/** Build the Jin Chinese phonemizer. `foreign` handles embedded Latin runs. */
export function createJin(foreign?: ForeignPhonemizer): Phonemizer {
    return createHanDictPhonemizer(dict, DEF, foreign);
}

/** Bare word→IPA (tests / eval): a Han run → IPA. */
export function phonemizeWord(word: string): string {
    return phonemizeHanWord(dict, DEF, word);
}

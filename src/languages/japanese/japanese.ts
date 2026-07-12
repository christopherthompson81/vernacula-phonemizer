/**
 * Japanese (ja) phonemizer — Standard/Tokyo, canonical IPA, espeak-independent. PHASE 1: a native kana/katakana
 * → IPA engine (kana.ts) + Sino-Japanese numbers. Kanji requires morphological segmentation + reading
 * resolution (to be ported from ~/Programming/espeak-ng-portable, Phase 2); kanji spans are skipped for now.
 * Pitch accent (ꜜ) is Phase 3. See docs/ja_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { kanaToIpa } from "./kana.ts";
import { numberToKana } from "./numbers.ts";

// Japanese clause punctuation → canonical pause marks.
const CLAUSE_MARK: Record<string, string> = { "。": ".", "．": ".", ".": ".", "！": "!", "!": "!", "？": "?", "?": "?", "、": ",", "，": ",", ",": "," };
// A kana run (hiragana + katakana + long mark + small kana), a digit run, or clause punctuation.
const TOKEN = /([ぁ-ゖァ-ヺー゛゜]+)|(\d+)|([。．.！!？?、，,])/gu;

class JapanesePhonemizer implements Phonemizer {
  text(input: string): string {
    let out = "";
    let pending: string | null = null;
    const emit = (ipa: string): void => {
      if (!ipa) return;
      if (out === "") out = ipa;
      else if (pending !== null) { out += ` ${pending} ${ipa}`; pending = null; }
      else out += ` ${ipa}`;
    };
    for (const m of input.matchAll(TOKEN)) {
      if (m[1]) { const ipa = kanaToIpa(m[1]); if (ipa) emit(ipa); }
      else if (m[2]) { const ipa = kanaToIpa(numberToKana(Number(m[2]))); if (ipa) emit(ipa); }
      else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk && out !== "") pending = mk; }
    }
    if (pending !== null && out !== "") out += ` ${pending}`;
    return out;
  }
}

/** One Japanese word (kana) → canonical IPA. */
export function phonemizeWord(word: string): string {
  return kanaToIpa(word) ?? "";
}

/** Build the Japanese phonemizer (Phase 1 — kana + numbers). */
export function createJapanese(): Phonemizer {
  return new JapanesePhonemizer();
}

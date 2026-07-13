/**
 * Korean (ko) phonemizer — Seoul standard, canonical IPA, espeak-independent. Hangul g2p (g2p.ts) with the full
 * cross-syllable sandhi + coda neutralisation; no lexicon. text() tokenizes Hangul words / numbers / punctuation.
 * See docs/ko_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { phonemizeWord } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";

export { phonemizeWord };

const CLAUSE_MARK: Record<string, string> = { ".": ".", "!": "!", "?": "?", "…": ",", ",": ",", ";": ",", ":": "," };
const TOKEN = /([가-힣]+)|(\d+)|([.!?…,;:])/gu;

class KoreanPhonemizer implements Phonemizer {
  text(input: string): string {
    let out = "";
    let pending: string | null = null;
    const emit = (ipa: string): void => {
      if (ipa === "") return;
      if (out === "") out = ipa;
      else if (pending !== null) { out += ` ${pending} ${ipa}`; pending = null; }
      else out += ` ${ipa}`;
    };
    for (const m of input.matchAll(TOKEN)) {
      if (m[1]) emit(phonemizeWord(m[1]));
      else if (m[2]) emit(phonemizeWord(numberToWords(Number(m[2]))));
      else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk && out !== "") pending = mk; }
    }
    if (pending !== null && out !== "") out += ` ${pending}`;
    return out;
  }
}

/** Build the Korean phonemizer (Hangul g2p + sandhi). */
export function createKorean(): Phonemizer {
  return new KoreanPhonemizer();
}

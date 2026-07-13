/**
 * Tamil (ta) phonemizer — canonical IPA, espeak-independent. Abugida g2p (g2p.ts) with Dravidian plosive
 * allophony + initial stress; no lexicon. text() tokenizes Tamil-script words / numbers / punctuation.
 * See docs/ta_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { phonemizeWord } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";

export { phonemizeWord };

const CLAUSE_MARK: Record<string, string> = { ".": ".", "!": "!", "?": "?", "…": ",", ",": ",", ";": ",", ":": "," };
// A Tamil-script word (U+0B80–U+0BFF), a number, or clause punctuation.
const TOKEN = /([஀-௿]+)|(\d+)|([.!?…,;:])/gu;

class TamilPhonemizer implements Phonemizer {
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
      else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) emit(phonemizeWord(wd));
      else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk && out !== "") pending = mk; }
    }
    if (pending !== null && out !== "") out += ` ${pending}`;
    return out;
  }
}

/** Build the Tamil phonemizer (rule-based abugida g2p). */
export function createTamil(): Phonemizer {
  return new TamilPhonemizer();
}

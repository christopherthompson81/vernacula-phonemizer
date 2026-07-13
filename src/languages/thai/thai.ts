/**
 * Thai (th) phonemizer — canonical IPA, espeak-independent (authored). Abugida g2p (g2p.ts) with computed tone;
 * words in the frequency corpus are pre-segmented. text() tokenizes Thai runs / numbers / punctuation.
 */
import type { Phonemizer } from "../../registry.ts";
import { phonemizeWord } from "./g2p.ts";
import { MANIFEST } from "./manifest.ts";

export { phonemizeWord };

const TOKEN = /([฀-๿]+)|(\d+)|([.!?…,;:])/gu;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

class ThaiPhonemizer implements Phonemizer {
  text(input: string): string {
    let out = "", pending: string | null = null;
    const emit = (ipa: string): void => {
      if (ipa === "") return;
      if (out === "") out = ipa;
      else if (pending !== null) { out += ` ${pending} ${ipa}`; pending = null; }
      else out += ` ${ipa}`;
    };
    for (const m of input.matchAll(TOKEN)) {
      if (m[1]) emit(phonemizeWord(m[1]));
      else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk && out !== "") pending = mk; }
    }
    if (pending !== null && out !== "") out += ` ${pending}`;
    return out;
  }
}
export function createThai(): Phonemizer { return new ThaiPhonemizer(); }

/**
 * Hausa (ha) phonemizer — Kano standard, canonical IPA, espeak-independent (AUTHORED beyond-espeak). Boko-
 * orthography g2p (g2p.ts) + penultimate stress + a Wiktionary-derived tone lexicon. text() tokenizes Hausa
 * words (incl. ɓ ɗ ƙ ƴ and apostrophe as a letter) / numbers / punctuation.
 * See docs/ha_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { phonemizeWord } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";

export { phonemizeWord };

const CLAUSE_MARK: Record<string, string> = { ".": ".", "!": "!", "?": "?", "…": ",", ",": ",", ";": ",", ":": "," };
// Hausa Boko letters incl. ɓ ɗ ƙ ƴ (and their capitals) + apostrophe (a letter: 'yan, 'a'a).
const TOKEN = /([a-zɓɗƙƴA-ZƁƊƘƳ'’]+)|(\d+)|([.!?…,;:])/gu;

class HausaPhonemizer implements Phonemizer {
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
      if (m[1]) emit(phonemizeWord(m[1].replace(/’/g, "'")));
      else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) emit(phonemizeWord(wd));
      else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk && out !== "") pending = mk; }
    }
    if (pending !== null && out !== "") out += ` ${pending}`;
    return out;
  }
}

/** Build the Hausa phonemizer (authored Boko g2p + tone lexicon). */
export function createHausa(): Phonemizer {
  return new HausaPhonemizer();
}

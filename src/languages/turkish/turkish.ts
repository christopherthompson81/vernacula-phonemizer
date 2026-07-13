/**
 * Turkish (tr) phonemizer — canonical IPA, espeak-independent. Rule-based g2p (g2p.ts) + final-syllable stress
 * (Turkish default) with a lexicon (stress.tsv, mostly place names / loanwords) for the exceptions. text()
 * tokenizes words / numbers / punctuation. See docs/tr_native_bringup_investigation.md.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Phonemizer } from "../../registry.ts";
import { toSegments, trLower } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";

// Stress exceptions: word → 1-based stressed syllable (default is the final syllable).
let STRESS: Map<string, number> | undefined;
function stressDict(): Map<string, number> {
  if (STRESS === undefined) {
    STRESS = new Map();
    try {
      const path = join(dirname(fileURLToPath(import.meta.url)), "stress.tsv");
      for (const line of readFileSync(path, "utf8").split("\n")) {
        if (line === "" || line.startsWith("#")) continue;
        const tab = line.indexOf("\t");
        if (tab > 0) STRESS.set(line.slice(0, tab), Number(line.slice(tab + 1)));
      }
    } catch { /* absent → pure final-syllable stress */ }
  }
  return STRESS;
}

const VOWEL_LETTER = /[aeıioöuüâîû]/;
/** A pre-stressing suffix's 1-based stressed syllable, or undefined. Currently the progressive -Iyor(+person):
 *  stress falls on the I of Iyor (geliyor→ɟelˈijoɾ, istiyorum→istˈijoɾum). This is a general morphological rule
 *  (the letter sequence Iyor is almost always the progressive morpheme), not a memorized lexicon. */
function morphStress(wl: string): number | undefined {
  const m = wl.match(/([ıiuü])yor(?:um|sun|uz|sunuz|lar|)$/);
  if (m && m.index !== undefined) {
    let syl = 0;
    for (let k = 0; k <= m.index; k++) if (VOWEL_LETTER.test(wl[k]!)) syl++;
    return syl;
  }
  return undefined;
}

/** Phonemize a single Turkish word to canonical IPA (with a stress mark before the stressed vowel). */
export function phonemizeWord(word: string): string {
  const segs = toSegments(word);
  const nuclei = segs.map((s, i) => (s.nucleus ? i : -1)).filter((i) => i >= 0);
  if (nuclei.length === 0) return segs.map((s) => s.ph).join("");
  // Stress: the exception lexicon's 1-based syllable if known, else a pre-stressing suffix rule, else final.
  const wl = trLower(word);
  const syl = stressDict().get(wl) ?? morphStress(wl);
  const stressIdx = syl !== undefined && syl >= 1 && syl <= nuclei.length ? nuclei[syl - 1]! : nuclei[nuclei.length - 1]!;
  let out = "";
  for (let i = 0; i < segs.length; i++) {
    if (i === stressIdx) out += "ˈ";
    out += segs[i]!.ph;
  }
  return out;
}

const CLAUSE_MARK: Record<string, string> = { ".": ".", "!": "!", "?": "?", "…": ",", ",": ",", ";": ",", ":": "," };
// A word (Turkish letters), a number, or clause punctuation. Turkish uses . as thousands sep and , as decimal.
const TOKEN = /([a-zçğıiöşüâîû]+)|(\d+(?:\.\d{3})*(?:,\d+)?)|([.!?…,;:])/giu;

/** A number token (Turkish thousands-dots / decimal-comma) → spoken words. */
function numberTokenToWords(tok: string): string {
  const [intRaw, frac] = tok.split(",");
  let words = numberToWords(Number(intRaw!.replace(/\./g, "")));
  if (frac !== undefined) words += " virgül " + [...frac].map((d) => numberToWords(Number(d))).join(" ");
  return words;
}

class TurkishPhonemizer implements Phonemizer {
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
      else if (m[2]) for (const wd of numberTokenToWords(m[2]).split(" ")) emit(phonemizeWord(wd));
      else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk && out !== "") pending = mk; }
    }
    if (pending !== null && out !== "") out += ` ${pending}`;
    return out;
  }
}

/** Build the Turkish phonemizer (rule g2p + final-syllable stress + an exception lexicon). */
export function createTurkish(): Phonemizer {
  return new TurkishPhonemizer();
}

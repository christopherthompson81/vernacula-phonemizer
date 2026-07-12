/**
 * German (de) phonemizer — Standard German, canonical IPA, espeak-independent. Rule-based g2p (g2p.ts) with
 * mostly-Germanic stress: the first syllable, or the first syllable after an unstressed prefix (be-/ge-/ver-…);
 * a stress lexicon (stress.tsv, from kaikki) overrides loanwords/exceptions. text() tokenizes words / numbers /
 * punctuation. See docs/de_native_bringup_investigation.md.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Phonemizer } from "../../registry.ts";
import { toSegments } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";

// Stress dictionary: word → 0-based ordinal of the stressed syllable nucleus (loanwords / exceptions).
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
    } catch { /* absent → pure rule stress */ }
  }
  return STRESS;
}

// Unstressed inseparable prefixes: stress falls on the syllable AFTER them.
const PREFIXES = ["ver", "ent", "emp", "zer", "ge", "be", "er"];

/** Ordinal of the stressed vowel by rule: first nucleus, or the first after an unstressed prefix. */
function ruleStress(w: string, nuclei: number): number {
  for (const p of PREFIXES) {
    if (w.startsWith(p) && w.length > p.length + 1 && nuclei > 1) return 1; // 2nd nucleus (prefix has one vowel)
  }
  return 0;
}

/** One German word → canonical IPA. */
export function phonemizeWord(word: string): string {
  const w = word.toLowerCase();
  const segs = toSegments(w);
  const vowelIdx = segs.map((s, i) => (s.vowel ? i : -1)).filter((i) => i >= 0);
  if (vowelIdx.length === 0) return segs.map((s) => s.ph).join("");
  const ord = stressDict().get(w) ?? ruleStress(w, vowelIdx.length);
  const stressPos = vowelIdx[Math.min(ord, vowelIdx.length - 1)]!;

  // Unstressed derivational prefix: reduce its vowel (be-/ge- → ə; ver-/er-/zer-/ent-/emp- → short ɛ). Only
  // when the first syllable is unstressed — so a ge-/be- ROOT (gehen, geben) is untouched.
  if (stressPos !== vowelIdx[0]) {
    const first = segs[vowelIdx[0]!]!;
    if (w.startsWith("be") || w.startsWith("ge")) first.ph = "ə";
    else if (/^(ver|zer|ent|emp|er)/.test(w)) first.ph = "ɛ";
  }
  let out = "";
  for (let i = 0; i < segs.length; i++) {
    if (i === stressPos && vowelIdx.length > 1) out += "ˈ";
    out += segs[i]!.ph;
  }
  return out;
}

const CLAUSE_MARK: Record<string, string> = { ".": ".", "!": "!", "?": "?", "…": ",", ",": ",", ";": ",", ":": "," };
const TOKEN = /([a-zäöüßA-ZÄÖÜ]+)|(\d+(?:[.,]\d+)?)|([.!?…,;:])/gu;

class GermanPhonemizer implements Phonemizer {
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
      else if (m[2]) {
        const [intPart, frac] = m[2].split(/[.,]/);
        for (const wd of numberToWords(Number(intPart)).split(" ")) emit(phonemizeWord(wd));
        if (frac !== undefined) { emit(phonemizeWord("Komma")); for (const d of frac) for (const wd of numberToWords(Number(d)).split(" ")) emit(phonemizeWord(wd)); }
      } else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk && out !== "") pending = mk; }
    }
    if (pending !== null && out !== "") out += ` ${pending}`;
    return out;
  }
}

/** Build the German phonemizer (rule g2p + stress rules + a loanword stress lexicon). */
export function createGerman(): Phonemizer {
  return new GermanPhonemizer();
}

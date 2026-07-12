/**
 * Russian (ru) phonemizer — standard Moscow Russian, canonical IPA, espeak-independent. Stress is lexical
 * (not derivable from spelling), so a stress dictionary (stress.tsv, word → stressed-vowel ordinal) feeds the
 * rule g2p (g2p.ts). Words not in the dictionary fall back to a default (first-vowel) stress. text()
 * tokenizes words / numbers / punctuation. See docs/ru_native_bringup_investigation.md.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Phonemizer } from "../../registry.ts";
import { toIpa } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";

// Stress dictionary: word → 0-based ordinal of the stressed vowel. Loaded once, lazily.
let STRESS: Map<string, number> | undefined;
function stressDict(): Map<string, number> {
  if (STRESS === undefined) {
    STRESS = new Map();
    const path = join(dirname(fileURLToPath(import.meta.url)), "stress.tsv");
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (line === "" || line.startsWith("#")) continue;
      const tab = line.indexOf("\t");
      if (tab > 0) STRESS.set(line.slice(0, tab), Number(line.slice(tab + 1)));
    }
  }
  return STRESS;
}

// Loanword hard-consonant-before-е/и lexicon: word → vowel ordinals whose preceding C is hard (тест → tɛst).
let HARD: Map<string, number[]> | undefined;
function hardDict(): Map<string, number[]> {
  if (HARD === undefined) {
    HARD = new Map();
    try {
      const path = join(dirname(fileURLToPath(import.meta.url)), "hard-e.tsv");
      for (const line of readFileSync(path, "utf8").split("\n")) {
        if (line === "" || line.startsWith("#")) continue;
        const tab = line.indexOf("\t");
        if (tab > 0) HARD.set(line.slice(0, tab), line.slice(tab + 1).split(",").map(Number));
      }
    } catch { /* absent → no loanword corrections */ }
  }
  return HARD;
}

const VOWEL_RE = /[аеёиоуыэюя]/gi;

// Closed-class irregulars the rules can't predict: чт→ʂt / чн→ʃn, and genitive -ого/-его → g→v. (The productive
// adjective-genitive г→v is grammatical, not listed here — a known Run-1 gap.)
const IRREGULARS: Record<string, string> = {
  что: "ʂto", чтобы: "ʂtˈobɨ", чтоб: "ʂtop", конечно: "kɐnʲˈeʃnə", скучно: "skˈuʃnə",
  его: "jɪvˈo", него: "nʲɪvˈo", сегодня: "sʲɪvˈodnʲə", ничего: "nʲɪt͡ɕɪvˈo", чей: "t͡ɕej",
  солнце: "sˈont͡sə", сердце: "sʲˈert͡sə", сейчас: "sʲɪt͡ɕˈas", здравствуйте: "zdrˈastvʊjtʲe", // silent л/д/в, dropped й
};

/** One Russian word → canonical IPA. Stress from the dictionary; ё is inherently stressed; else first vowel. */
export function phonemizeWord(word: string): string {
  const w = word.toLowerCase();
  const irr = IRREGULARS[w];
  if (irr !== undefined) return irr;
  let ord = stressDict().get(w);
  if (ord === undefined) {
    const eIdx = [...w.matchAll(VOWEL_RE)].findIndex((m) => m[0] === "ё");
    ord = eIdx >= 0 ? eIdx : 0;                    // ё is always stressed; otherwise default to the first vowel
  }
  return toIpa(w, ord, hardDict().get(w));
}

const CLAUSE_MARK: Record<string, string> = { ".": ".", "!": "!", "?": "?", "…": ",", ",": ",", ";": ",", ":": "," };
const TOKEN = /([а-яёА-ЯЁ]+)|(\d+(?:[.,]\d+)?)|([.!?…,;:])/gu;

class RussianPhonemizer implements Phonemizer {
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
        if (frac !== undefined) { emit(phonemizeWord("целых")); for (const d of frac) for (const wd of numberToWords(Number(d)).split(" ")) emit(phonemizeWord(wd)); }
      } else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk && out !== "") pending = mk; }
    }
    if (pending !== null && out !== "") out += ` ${pending}`;
    return out;
  }
}

/** Build the Russian phonemizer (stress dictionary + rule g2p). */
export function createRussian(): Phonemizer {
  return new RussianPhonemizer();
}

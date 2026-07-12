/**
 * Mandarin Chinese (cmn) phonemizer — canonical IPA. Phase 1: the pinyin input path (tokenized pinyin with
 * tone digits → IPA with Chao tones + third-tone sandhi). Phase 2 adds the Hanzi front-end (pypinyin char +
 * phrase dicts → polyphone-aware pinyin), Phase 3 numbers + normalization. The data (syllable→IPA table,
 * tone system, sandhi) lives beside this file; this module wires it into the Phonemizer interface.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Phonemizer } from "../../registry.ts";
import { makePinyinToIpa, type MandarinTables } from "./pinyinToIpa.ts";
import { segment, type PinyinTables } from "./segment.ts";
import { applyYiBuSandhi } from "./yiBuSandhi.ts";
import { arabicToChinese, digitsToChinese } from "./numbers.ts";

const HAN = /\p{Script=Han}/u;
const LATIN = /[A-Za-z]/;
// Clause / phrase punctuation (Chinese + ASCII) → canonical inline pause marks.
const CLAUSE_MARK: Record<string, string> = {
  "。": ".", "！": "!", "？": "?", "，": ",", "、": ",", "；": ",", "：": ",", "…": ",", "—": ",",
  ".": ".", "!": "!", "?": "?", ",": ",", ";": ",", ":": ",",
};
// Common measure words: a standalone 2 before one of these reads colloquial 两 (两个, 两天), not 二.
const MEASURE_WORDS = "个位本张只条头匹件双对群种次遍回天年岁块层排组步口面名首部台辆架座间扇页杯碗瓶盒袋斤";

/** A number's spoken reading depends on context: 4-digit before 年 = year digits; a lone 2 before a measure
 *  word = 两; otherwise a quantity. */
function readNumber(num: string, after: string | undefined): string {
  if (/^\d{4}$/.test(num) && after === "年") return digitsToChinese(num);   // 2024年 → 二〇二四年
  if (num === "2" && after !== undefined && MEASURE_WORDS.includes(after)) return "两"; // 2个 → 两个
  return arabicToChinese(num);
}

/** Embedded Latin → foreign (en) phonemizer, injected by the registry (lazy, like Hindi). */
export type ForeignPhonemizer = (latin: string) => string;

class MandarinPhonemizer implements Phonemizer {
  private readonly pinyinToIpa: (pinyin: string) => string;

  constructor(tables: MandarinTables, private readonly pinyin: PinyinTables, private readonly foreign?: ForeignPhonemizer) {
    this.pinyinToIpa = makePinyinToIpa(tables);
  }

  /** A Han run (with a per-char synth mask): segment → 一/不 sandhi → pinyin → IPA (3-3 sandhi within run). */
  private hanRun(chars: string[], synth: boolean[]): string {
    const tokens = segment(chars, this.pinyin, synth);
    applyYiBuSandhi(tokens);
    return this.pinyinToIpa(tokens.map((t) => t.py).join(" "));
  }

  /** Substitute Arabic numbers with Chinese numeral characters, tracking which code points are synthesized. */
  private substituteNumbers(input: string): { cp: string[]; synth: boolean[] } {
    const cp: string[] = [], synth: boolean[] = [];
    const push = (text: string, s: boolean): void => { for (const c of text) { cp.push(c); synth.push(s); } };
    let last = 0;
    const re = /\d+(?:\.\d+)?/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(input)) !== null) {
      if (m.index > last) push(input.slice(last, m.index), false);
      push(readNumber(m[0], input[m.index + m[0].length]), true);
      last = m.index + m[0].length;
    }
    if (last < input.length) push(input.slice(last), false);
    return { cp, synth };
  }

  text(input: string): string {
    // Pure pinyin input (letters, no Han) keeps the direct tone-digit path (e.g. "ni3 hao3").
    if (/[a-zü]/i.test(input) && !HAN.test(input)) return this.pinyinToIpa(input);

    const { cp, synth } = this.substituteNumbers(input);
    let out = "";
    let pending: string | null = null;
    const emit = (ipa: string): void => {
      if (ipa === "") return;
      if (out === "") out = ipa;
      else if (pending !== null) { out += ` ${pending} ${ipa}`; pending = null; }
      else out += ` ${ipa}`;
    };
    let i = 0;
    while (i < cp.length) {
      const ch = cp[i]!;
      if (HAN.test(ch)) {                       // Han run (may include synthesized numerals)
        let j = i; while (j < cp.length && HAN.test(cp[j]!)) j++;
        emit(this.hanRun(cp.slice(i, j), synth.slice(i, j)));
        i = j;
      } else if (LATIN.test(ch)) {              // Latin run → foreign (en)
        let j = i; while (j < cp.length && LATIN.test(cp[j]!)) j++;
        emit(this.foreign ? this.foreign(cp.slice(i, j).join("")) : "");
        i = j;
      } else {                                  // punctuation → pending pause; other → skip
        const mk = CLAUSE_MARK[ch]; if (mk && out !== "") pending = mk;
        i++;
      }
    }
    if (pending !== null && out !== "") out += ` ${pending}`;
    return out;
  }
}

/** Load the Mandarin data (beside this file) and build the phonemizer. `foreign` handles embedded Latin. */
export function createMandarin(foreign?: ForeignPhonemizer): Phonemizer {
  const dir = dirname(fileURLToPath(import.meta.url));
  const read = (f: string): string => readFileSync(join(dir, f), "utf8");

  const syllableIpa = new Map<string, string>();
  for (const line of read("syllable-ipa.tsv").split("\n")) {
    if (line === "" || line.startsWith("#")) continue;
    const tab = line.indexOf("\t");
    if (tab > 0) syllableIpa.set(line.slice(0, tab), line.slice(tab + 1));
  }

  const manifest = JSON.parse(read("cmn.jsonc").replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")) as {
    tones: Record<string, string>;
  };

  const chars = new Map<string, string[]>();
  for (const line of read("chars.tsv").split("\n")) {
    if (line === "" || line.startsWith("#")) continue;
    const tab = line.indexOf("\t");
    if (tab > 0) chars.set(line.slice(0, tab), line.slice(tab + 1).split(","));
  }
  const phrases = new Map<string, string>();
  let maxPhrase = 2;
  for (const line of read("phrases.tsv").split("\n")) {
    if (line === "" || line.startsWith("#")) continue;
    const tab = line.indexOf("\t");
    if (tab > 0) {
      const key = line.slice(0, tab);
      phrases.set(key, line.slice(tab + 1));
      const len = Array.from(key).length;
      if (len > maxPhrase) maxPhrase = len;
    }
  }

  return new MandarinPhonemizer({ syllableIpa, tones: manifest.tones }, { chars, phrases, maxPhrase }, foreign);
}

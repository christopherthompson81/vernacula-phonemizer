/**
 * Thai grapheme→phoneme engine (authored beyond-espeak). The hard structural work — leading-vowel reorder,
 * อักษรนำ leaders, the schwa/inherent-vowel algorithm, syllable segmentation, and computed tone — is done by
 * the ported syllabifier (syllabifier.ts, from our espeak-ng-portable Thai front-end). This module RENDERS the
 * resulting {onset, nucleus, coda, tone} syllable structure to IPA directly (instead of the espeak L2S path).
 * Contributes ɤ. See docs/th_native_bringup_investigation.md.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { reorderThaiLeadingVowels, thaiLexicalFixup, thaiPrep, thaiScanSyllables, type ThaiSyllableScan } from "./syllabifier.ts";
import { THAI_TONE_IPA } from "./thaiTone.ts";

// Lexical dictionary of irregulars (length, silent-ร Sanskrit, cluster-under-leading-vowel) the rules can't
// derive — word → IPA (Chao). Ported from espeak-ng-portable's Thai dictionary; consulted BEFORE the rule engine.
let DICT: Map<string, string> | undefined;
function dict(): Map<string, string> {
  if (DICT === undefined) {
    DICT = new Map();
    try {
      const path = join(dirname(fileURLToPath(import.meta.url)), "dictionary.tsv");
      for (const line of readFileSync(path, "utf8").split("\n")) {
        if (line === "" || line.startsWith("#")) continue;
        const tab = line.indexOf("\t");
        if (tab > 0) DICT.set(line.slice(0, tab), line.slice(tab + 1));
      }
    } catch { /* absent → rules only */ }
  }
  return DICT;
}

// Onset consonant grapheme → IPA. อ = glottal ʔ; a silent leader is dropped before this map is consulted.
const INIT: Record<string, string> = {
  "ก": "k", "ข": "kʰ", "ฃ": "kʰ", "ค": "kʰ", "ฅ": "kʰ", "ฆ": "kʰ", "ง": "ŋ", "จ": "t͡ɕ", "ฉ": "t͡ɕʰ",
  "ช": "t͡ɕʰ", "ซ": "s", "ฌ": "t͡ɕʰ", "ญ": "j", "ฎ": "d", "ฏ": "t", "ฐ": "tʰ", "ฑ": "tʰ", "ฒ": "tʰ",
  "ณ": "n", "ด": "d", "ต": "t", "ถ": "tʰ", "ท": "tʰ", "ธ": "tʰ", "น": "n", "บ": "b", "ป": "p", "ผ": "pʰ",
  "ฝ": "f", "พ": "pʰ", "ฟ": "f", "ภ": "pʰ", "ม": "m", "ย": "j", "ร": "r", "ล": "l", "ว": "w", "ศ": "s",
  "ษ": "s", "ส": "s", "ห": "h", "ฬ": "l", "อ": "ʔ", "ฮ": "h", "ฤ": "r",
};
const CODA: Record<string, string> = {
  "ก": "k", "ข": "k", "ค": "k", "ฆ": "k", "ง": "ŋ", "จ": "t", "ช": "t", "ซ": "t", "ฎ": "t", "ฏ": "t",
  "ฐ": "t", "ฑ": "t", "ฒ": "t", "ด": "t", "ต": "t", "ถ": "t", "ท": "t", "ธ": "t", "ศ": "t", "ษ": "t",
  "ส": "t", "ญ": "n", "ณ": "n", "น": "n", "ร": "n", "ล": "n", "ฬ": "n", "บ": "p", "ป": "p", "พ": "p",
  "ฟ": "p", "ภ": "p", "ม": "m", "ย": "j", "ว": "w",
};
// Written-vowel unit (gs joined) → base quality (no length; ː is added from the scan's `long`). Diphthongs
// (ua/ia/ɯa and the glide vowels) are in NO_LENGTH so they never take ː.
const VQUAL: Record<string, string> = {
  "ะ": "a", "ั": "a", "า": "a", "ิ": "i", "ี": "i", "ึ": "ɯ", "ื": "ɯ", "ือ": "ɯ", "ุ": "u", "ู": "u", "ๅ": "a",
  "ัว": "ua", "ัวะ": "ua", "ว": "ua",
  "เ": "e", "เะ": "e", "แ": "ɛ", "แะ": "ɛ", "โ": "o", "โะ": "o",
  "เาะ": "ɔ", "เอ": "ɤ", "เอะ": "ɤ", "เิ": "ɤ", "เย": "ɤ", "เา": "a", "อ": "ɔ",
  "เีย": "ia", "เียะ": "ia", "เือ": "ɯa", "เือะ": "ɯa",
  "ไ": "a", "ใ": "a", "ไย": "a", "ำ": "a",
};
const NO_LENGTH = new Set(["ua", "ia", "ɯa"]); // diphthongs — never take ː
const FORCE_LONG = new Set(["เอ", "เิ"]);      // เ–อ / เ–ิ are ɤː (long); the short exceptions (เงิน) are in the dict
const RAISABLE = new Set([..."งญณนมยรลฬว"]);

/** Onset IPA for a syllable, dropping a silent ห/อ leader and joining any cluster. */
function onsetIpa(cs: string[], first: boolean): string {
  let g = cs;
  if (g.length >= 2 && ((g[0] === "ห" && RAISABLE.has(g[1]!)) || (first && g[0] === "อ" && g[1] === "ย"))) g = g.slice(1);
  return g.map((c) => INIT[c] ?? "").join("");
}

/** Render one scanned syllable to IPA (onset + nucleus + tone + coda). */
function renderSyllable(s: ThaiSyllableScan, first: boolean, last: boolean): string {
  const onset = onsetIpa(s.onsetCs, first);
  let nucleus: string, glide = "", vShort = false;
  if (s.nucUnit.kind === "C") {
    nucleus = s.fate === "o" ? "o" : "a"; // inherent vowel (short) — no glottal
  } else {
    const gs = s.nucUnit.gs.join("");
    const q = VQUAL[gs] ?? "a";
    if (s.nucUnit.glide) glide = s.nucUnit.glide;   // ไ/ใ/ำ → j/m coda (short vowel)
    else if (gs === "เา") glide = "w";              // เ–า → aw (short)
    const isEy = gs === "เย";                       // เ–ย → ɤːj (long ɤ, glide j)
    const long = (s.long || FORCE_LONG.has(gs) || isEy) && !NO_LENGTH.has(q) && (glide === "" || isEy);
    nucleus = q + (long ? "ː" : "");
    vShort = !long && glide === "" && !NO_LENGTH.has(q); // an explicit SHORT written vowel, open (not a diphthong)
  }
  const coda = s.codaG ? (CODA[s.codaG] ?? "") : glide;
  const tone = s.tone ? THAI_TONE_IPA[s.tone] : "";
  // A word-FINAL short open syllable takes a glottal ʔ — a written short vowel (จะ→t͡ɕaʔ) or a standalone
  // single-consonant letter with its inherent vowel (ณ→naʔ). A non-final minor short syllable does not.
  const openLast = last && !coda;
  const finalCoda = coda || (openLast && (vShort || s.nucUnit.kind === "C") ? "ʔ" : "");
  return onset + nucleus + tone + finalCoda;
}

/** One Thai word → canonical IPA (dictionary of irregulars, else the ported syllabifier + native render). */
export function phonemizeWord(word: string): string {
  const lex = dict().get(word);
  if (lex !== undefined) return lex;
  const reordered = reorderThaiLeadingVowels(thaiLexicalFixup(word));
  const prep = thaiPrep(reordered);
  if (!prep) return "";
  const syls = thaiScanSyllables(prep.units, prep.fates, prep.unitMark, prep.shortMark);
  // Stress: ˈ on the first syllable; ˌ on even nucleus indices ≥2 (syllables 3, 5, 7…).
  return syls.map((s, i) => {
    const syl = renderSyllable(s, i === 0, i === syls.length - 1);
    const mark = i === 0 ? "ˈ" : (i >= 2 && i % 2 === 0 ? "ˌ" : "");
    if (mark === "") return syl;
    const m = syl.match(/[aeiouɛɔɤɯ]/u);
    return m && m.index !== undefined ? syl.slice(0, m.index) + mark + syl.slice(m.index) : mark + syl;
  }).join("");
}

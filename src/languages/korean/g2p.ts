/**
 * Korean grapheme→phoneme engine (Seoul standard), espeak-independent. Hangul syllable blocks are decomposed
 * algorithmically into initial (L) / medial (V) / final (T) jamo, then Korean's extensive cross-syllable sandhi
 * is applied over the jamo sequence:
 *   - liaison: a coda before a null-onset (ㅇ) vowel moves to onset (국이→kuɡi); ㅎ deletes (좋아→t͡ɕoɐ);
 *   - palatalization: ㄷ/ㅌ + 이 → t͡ɕ/t͡ɕʰ (같이→kɐt͡ɕʰi);
 *   - lenis voicing: ㄱㄷㅂㅈ → ɡdbd͡ʑ after a vowel/sonorant (가다→kɐdɐ);
 *   - aspiration: ㅎ ± a lenis stop → aspirated (놓고→nokʰo, 좋다→t͡ɕotʰɐ);
 *   - tensification: an obstruent coda + a lenis stop → tense (학교→hɐk̚k͈jo, 맑다→mɐk̚t͈ɐ);
 *   - nasalization: an obstruent coda + a nasal → nasal coda (국물→kuŋmuɭ… wait kuŋmul; 합니→hɐmni);
 *   - lateralization: ㄴㄹ / ㄹㄴ → ll (신라→siɭɭɐ);
 *   - coda neutralization: the 7 possible codas, obstruents unreleased ̚ (밥→pɐp̚).
 * Contributes ̚ (unreleased) and ͈ (tense). See docs/ko_native_bringup_investigation.md.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SBASE = 0xac00, LCOUNT = 19, VCOUNT = 21, TCOUNT = 28, NCOUNT = VCOUNT * TCOUNT;
// Jamo inventories (index order per the Unicode decomposition).
const L_JAMO = [..."ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"];
const V_JAMO = [..."ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"];
const T_JAMO = ["", ..."ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"];

// Onset (initial) jamo → phoneme (underlying, before voicing). ㅇ = null onset.
const ONSET: Record<string, string> = {
  "ㄱ": "k", "ㄲ": "k͈", "ㄴ": "n", "ㄷ": "t", "ㄸ": "t͈", "ㄹ": "ɾ", "ㅁ": "m", "ㅂ": "p", "ㅃ": "p͈",
  "ㅅ": "s", "ㅆ": "s͈", "ㅇ": "", "ㅈ": "t͡ɕ", "ㅉ": "t͡ɕ͈", "ㅊ": "t͡ɕʰ", "ㅋ": "kʰ", "ㅌ": "tʰ", "ㅍ": "pʰ", "ㅎ": "h",
};
const VOWEL: Record<string, string> = {
  "ㅏ": "ɐ", "ㅐ": "ɛ", "ㅑ": "jɐ", "ㅒ": "jɛ", "ㅓ": "ɘ", "ㅔ": "e", "ㅕ": "jɘ", "ㅖ": "je", "ㅗ": "o",
  "ㅘ": "wɐ", "ㅙ": "wɛ", "ㅚ": "we", "ㅛ": "jo", "ㅜ": "u", "ㅝ": "wɘ", "ㅞ": "we", "ㅟ": "wi", "ㅠ": "ju",
  "ㅡ": "ɯ", "ㅢ": "ɯi", "ㅣ": "i",
};
// Coda jamo → { cons: survivor before a consonant/pause (UNDERLYING jamo); lc: coda kept when liaised before a
// vowel; lo: consonant released to the next onset when liaised }. Single codas keep their underlying jamo (so
// liaison restores it: 같이 → ㅌ → t͡ɕʰ); clusters split.
const CODA: Record<string, { cons: string; lc: string; lo: string }> = {
  "ㄱ": { cons: "ㄱ", lc: "", lo: "ㄱ" }, "ㄲ": { cons: "ㄲ", lc: "", lo: "ㄲ" }, "ㄴ": { cons: "ㄴ", lc: "", lo: "ㄴ" },
  "ㄷ": { cons: "ㄷ", lc: "", lo: "ㄷ" }, "ㄹ": { cons: "ㄹ", lc: "", lo: "ㄹ" }, "ㅁ": { cons: "ㅁ", lc: "", lo: "ㅁ" },
  "ㅂ": { cons: "ㅂ", lc: "", lo: "ㅂ" }, "ㅅ": { cons: "ㅅ", lc: "", lo: "ㅅ" }, "ㅆ": { cons: "ㅆ", lc: "", lo: "ㅆ" },
  "ㅇ": { cons: "ㅇ", lc: "ㅇ", lo: "ㅇ" }, "ㅈ": { cons: "ㅈ", lc: "", lo: "ㅈ" }, "ㅊ": { cons: "ㅊ", lc: "", lo: "ㅊ" },
  "ㅋ": { cons: "ㅋ", lc: "", lo: "ㅋ" }, "ㅌ": { cons: "ㅌ", lc: "", lo: "ㅌ" }, "ㅍ": { cons: "ㅍ", lc: "", lo: "ㅍ" },
  "ㅎ": { cons: "ㅎ", lc: "", lo: "ㅎ" },
  "ㄳ": { cons: "ㄱ", lc: "ㄱ", lo: "ㅅ" }, "ㄵ": { cons: "ㄴ", lc: "ㄴ", lo: "ㅈ" }, "ㄶ": { cons: "ㄴ", lc: "ㄴ", lo: "ㅎ" },
  "ㄺ": { cons: "ㄱ", lc: "ㄹ", lo: "ㄱ" }, "ㄻ": { cons: "ㅁ", lc: "ㄹ", lo: "ㅁ" }, "ㄼ": { cons: "ㄹ", lc: "ㄹ", lo: "ㅂ" },
  "ㄽ": { cons: "ㄹ", lc: "ㄹ", lo: "ㅅ" }, "ㄾ": { cons: "ㄹ", lc: "ㄹ", lo: "ㅌ" }, "ㄿ": { cons: "ㅂ", lc: "ㄹ", lo: "ㅍ" },
  "ㅀ": { cons: "ㄹ", lc: "ㄹ", lo: "ㅎ" }, "ㅄ": { cons: "ㅂ", lc: "ㅂ", lo: "ㅅ" },
};
// Underlying coda jamo → surface phoneme (7-way neutralisation; obstruents unreleased).
const CODA_PH: Record<string, string> = {
  "ㄱ": "k̚", "ㄲ": "k̚", "ㅋ": "k̚", "ㄷ": "t̚", "ㅅ": "t̚", "ㅆ": "t̚", "ㅈ": "t̚", "ㅊ": "t̚", "ㅌ": "t̚", "ㅎ": "t̚",
  "ㅂ": "p̚", "ㅍ": "p̚", "ㄴ": "n", "ㅁ": "m", "ㅇ": "ŋ", "ㄹ": "ɭ",
};
const NASAL_CODA = new Set(["ㄴ", "ㅁ", "ㅇ"]);
// 7-way coda neutralisation to a representative jamo (for the obstruent-based sandhi rules).
const NEUT: Record<string, string> = {
  "ㄱ": "ㄱ", "ㄲ": "ㄱ", "ㅋ": "ㄱ", "ㄷ": "ㄷ", "ㅅ": "ㄷ", "ㅆ": "ㄷ", "ㅈ": "ㄷ", "ㅊ": "ㄷ", "ㅌ": "ㄷ", "ㅎ": "ㄷ",
  "ㅂ": "ㅂ", "ㅍ": "ㅂ", "ㄴ": "ㄴ", "ㅁ": "ㅁ", "ㅇ": "ㅇ", "ㄹ": "ㄹ",
};
const OBSTR_CODA_TO_NASAL: Record<string, string> = { "ㄱ": "ㅇ", "ㄷ": "ㄴ", "ㅂ": "ㅁ" }; // before a nasal onset
const VOICE: Record<string, string> = { k: "ɡ", t: "d", p: "b", "t͡ɕ": "d͡ʑ" };
const TENSE: Record<string, string> = { k: "k͈", t: "t͈", p: "p͈", "t͡ɕ": "t͡ɕ͈", s: "s͈" };

// Lexical tensification onset jamo → its tense counterpart (lenis → fortis).
const TENSE_JAMO: Record<string, string> = { "ㄱ": "ㄲ", "ㄷ": "ㄸ", "ㅂ": "ㅃ", "ㅅ": "ㅆ", "ㅈ": "ㅉ" };
// Korean lexical/사잇소리 tensification (경음화) that is NOT phonologically rule-derivable (Sino-Korean §26
// needs Hanja etymology). Word → 0-based syllable indices whose onset tenses. From wikipron (tensification.tsv).
let TENS: Map<string, number[]> | undefined;
function tensLexicon(): Map<string, number[]> {
  if (TENS === undefined) {
    TENS = new Map();
    try {
      const path = join(dirname(fileURLToPath(import.meta.url)), "tensification.tsv");
      for (const line of readFileSync(path, "utf8").split("\n")) {
        if (line === "" || line.startsWith("#")) continue;
        const tab = line.indexOf("\t");
        if (tab > 0) TENS.set(line.slice(0, tab), line.slice(tab + 1).split(",").map(Number));
      }
    } catch { /* absent → rule tensification only */ }
  }
  return TENS;
}

interface Syl { L: string; V: string; T: string } // jamo; T = "" if none

/** Decompose a run into syllables (non-Hangul chars are dropped). */
function decompose(word: string): Syl[] {
  const out: Syl[] = [];
  for (const ch of word) {
    const c = ch.codePointAt(0)!;
    if (c < SBASE || c > 0xd7a3) continue;
    const s = c - SBASE;
    out.push({ L: L_JAMO[Math.floor(s / NCOUNT)]!, V: V_JAMO[Math.floor((s % NCOUNT) / TCOUNT)]!, T: T_JAMO[s % TCOUNT]! });
  }
  return out;
}

/** One Korean word → canonical IPA (Hangul decomposition + sandhi + coda neutralisation). */
export function phonemizeWord(word: string): string {
  const syls = decompose(word);
  if (syls.length === 0) return "";
  // coda[i] = the underlying coda jamo kept before a consonant/pause; onset[i] = onset jamo (reassigned by liaison).
  const coda: string[] = syls.map((s) => (s.T ? CODA[s.T]!.cons : ""));
  const onset: string[] = syls.map((s) => s.L);
  const liaised: boolean[] = syls.map(() => false); // onset was moved here by liaison (gates palatalization)

  // Cross-boundary sandhi (coda of i vs onset of i+1).
  for (let i = 0; i < syls.length - 1; i++) {
    const cd = coda[i]!;
    if (cd === "") continue;
    const on = onset[i + 1]!;
    // LIAISON: coda before a null onset ㅇ — the underlying consonant moves to onset (ㅎ deletes).
    if (on === "ㅇ") {
      const info = CODA[syls[i]!.T]!;
      if (info.lo === "ㅎ") { coda[i] = info.lc; onset[i + 1] = "ㅇ"; } // ㅎ deletes before a vowel
      else { onset[i + 1] = info.lo; coda[i] = info.lc; liaised[i + 1] = true; }
      continue;
    }
    // ㅎ coda + lenis stop → aspirate the onset; ㅎ deletes (checks the UNDERLYING ㅎ, incl. ㄶ/ㅀ clusters).
    if (cd === "ㅎ" && (on === "ㄱ" || on === "ㄷ" || on === "ㅈ" || on === "ㅅ")) {
      onset[i + 1] = { "ㄱ": "ㅋ", "ㄷ": "ㅌ", "ㅈ": "ㅊ", "ㅅ": "ㅆ" }[on]!; coda[i] = syls[i]!.T === "ㄶ" ? "ㄴ" : syls[i]!.T === "ㅀ" ? "ㄹ" : ""; continue;
    }
    const ncd = NEUT[cd] ?? cd; // 7-way neutralised coda for the obstruent-based rules below
    // stop coda + ㅎ onset → aspirate; the ㅎ becomes the aspirated stop, coda drops.
    if (on === "ㅎ" && (ncd === "ㄱ" || ncd === "ㄷ" || ncd === "ㅂ")) {
      onset[i + 1] = { "ㄱ": "ㅋ", "ㄷ": "ㅌ", "ㅂ": "ㅍ" }[ncd]!; coda[i] = ""; continue;
    }
    // LATERALIZATION: ㄴㄹ or ㄹㄴ → ll.
    if ((ncd === "ㄴ" && on === "ㄹ") || (ncd === "ㄹ" && on === "ㄴ")) { coda[i] = "ㄹ"; onset[i + 1] = "ㄹ"; continue; }
    // NASALIZATION: obstruent coda + nasal onset → the coda becomes the homorganic nasal.
    if ((on === "ㄴ" || on === "ㅁ") && ncd in OBSTR_CODA_TO_NASAL) { coda[i] = OBSTR_CODA_TO_NASAL[ncd]!; continue; }
    // ㄹ after an obstruent(→nasal) or a nasal coda → ㄴ (독립→toŋnip, 국립).
    if (on === "ㄹ" && (ncd in OBSTR_CODA_TO_NASAL || NASAL_CODA.has(ncd))) {
      onset[i + 1] = "ㄴ";
      if (ncd in OBSTR_CODA_TO_NASAL) coda[i] = OBSTR_CODA_TO_NASAL[ncd]!;
      continue;
    }
    // TENSIFICATION: obstruent coda + lenis stop/s → tense.
    if ((ncd === "ㄱ" || ncd === "ㄷ" || ncd === "ㅂ") && ONSET[on]! in TENSE) {
      onset[i + 1] = { "ㄱ": "ㄲ", "ㄷ": "ㄸ", "ㅂ": "ㅃ", "ㅅ": "ㅆ", "ㅈ": "ㅉ" }[on] ?? on;
    }
  }

  // LEXICAL tensification (경음화): force-tense the onsets the lexicon lists for this word (a tense onset
  // never voices). Applied after sandhi so it overrides the lenis realisation.
  const tens = tensLexicon().get(word);
  if (tens) for (const j of tens) if (onset[j] !== undefined && onset[j]! in TENSE_JAMO) onset[j] = TENSE_JAMO[onset[j]!]!;

  // Stress: the first HEAVY (coda-bearing, underlying) syllable; if none is closed, the first syllable.
  let stressIdx = syls.findIndex((s) => s.T !== "");
  if (stressIdx < 0) stressIdx = 0;

  // Realize phonemes; ˈ goes before the stressed syllable's nucleus (after its onset).
  let out = "";
  const isSonorant = (cd: string): boolean => NASAL_CODA.has(cd) || cd === "ㄹ";
  for (let i = 0; i < syls.length; i++) {
    // onset
    let onPh = ONSET[onset[i]!] ?? "";
    const prevCoda = i > 0 ? coda[i - 1]! : null;
    // palatalization ㄷ/ㅌ + 이 → t͡ɕ/t͡ɕʰ (onset came from a liaised ㄷ/ㅌ before ㅣ).
    if (liaised[i]! && (onset[i] === "ㄷ" || onset[i] === "ㅌ") && syls[i]!.V === "ㅣ") onPh = onset[i] === "ㄷ" ? "t͡ɕ" : "t͡ɕʰ";
    // ㄹ onset after a ㄹ coda → the lateral ɭ (geminate ll: 신라→siɭɭɐ); elsewhere ㄹ onset is the tap ɾ.
    else if (onset[i] === "ㄹ" && prevCoda === "ㄹ") onPh = "ɭ";
    // lenis voicing between sonorants/vowels (prev syllable had a vowel or a sonorant coda, and no coda here-before).
    const voiceable = onPh in VOICE;
    const afterSonorant = i > 0 && (prevCoda === "" || (prevCoda !== null && isSonorant(prevCoda)));
    if (voiceable && afterSonorant) onPh = VOICE[onPh]!;
    out += onPh;
    if (i === stressIdx) out += "ˈ"; // ˈ before the whole medial (incl. any onglide j/w — espeak convention)
    out += VOWEL[syls[i]!.V] ?? "";
    // coda
    if (coda[i]) out += CODA_PH[coda[i]!] ?? "";
  }
  return out;
}

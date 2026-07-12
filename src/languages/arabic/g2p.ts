/**
 * Arabic diacritized grapheme→phoneme engine (Modern Standard Arabic, broad phonemic). Takes FULLY-VOWELLED
 * Arabic (harakat present) and produces canonical IPA — cleanroom, rule-based, no lexicon. Short-vowel
 * restoration for bare text is a separate pre-pass (the neural diacritizer); this engine assumes the vowels
 * are already there. Arabic is stored in logical order = phonetic order, so RTL is a non-issue.
 * See docs/ar_native_bringup_investigation.md for the convention.
 */

// Consonant letter → IPA. Emphatics carry ˤ; pharyngeals ʕ/ħ; all hamza seats → ʔ.
const CONS: Record<string, string> = {
  "ب": "b", "ت": "t", "ث": "θ", "ج": "d͡ʒ", "ح": "ħ", "خ": "x", "د": "d", "ذ": "ð", "ر": "r", "ز": "z",
  "س": "s", "ش": "ʃ", "ص": "sˤ", "ض": "dˤ", "ط": "tˤ", "ظ": "ðˤ", "ع": "ʕ", "غ": "ɣ", "ف": "f", "ق": "q",
  "ك": "k", "ل": "l", "م": "m", "ن": "n", "ه": "h", "و": "w", "ي": "j",
  "ء": "ʔ", "أ": "ʔ", "إ": "ʔ", "ؤ": "ʔ", "ئ": "ʔ",
};
const FATHA = "َ", KASRA = "ِ", DAMMA = "ُ", SUKUN = "ْ", SHADDA = "ّ";
const TANWIN_A = "ً", TANWIN_I = "ٍ", TANWIN_U = "ٌ", DAGGER = "ٰ";
const ALIF = "ا", ALIF_MAQSURA = "ى", ALIF_MADDA = "آ", TAA_MARBUTA = "ة", WAW = "و", YA = "ي";
const HARAKAT = new Set([FATHA, KASRA, DAMMA, SUKUN, SHADDA, TANWIN_A, TANWIN_I, TANWIN_U, DAGGER]);
// Sun letters: the article's ل assimilates into them (gemination); moon letters keep the l.
const SUN = new Set(["ت", "ث", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ل", "ن"]);

export interface Seg {
  ph: string;        // IPA phoneme(s)
  vowel: boolean;    // is a syllable nucleus
}

/** Read the vowel that follows a consonant at index i. Returns the IPA vowel (may be a long vowel or
 *  diphthong that consumes a following ا/ي/و) and the next index. "" = sukun / no vowel. */
function readVowel(s: string, i: number): { v: string; next: number } {
  const c = s[i];
  const after = (k: number): string => s[k] ?? "";
  const isBareGlide = (k: number): boolean => !HARAKAT.has(after(k + 1)); // ي/و with no harakat of its own = long-vowel marker
  switch (c) {
    case FATHA:
      if (after(i + 1) === ALIF || after(i + 1) === ALIF_MAQSURA || after(i + 1) === DAGGER) return { v: "aː", next: i + 2 };
      if (after(i + 1) === YA && after(i + 2) === SUKUN) return { v: "aj", next: i + 3 };
      if (after(i + 1) === WAW && after(i + 2) === SUKUN) return { v: "aw", next: i + 3 };
      return { v: "a", next: i + 1 };
    case KASRA:
      if (after(i + 1) === YA && isBareGlide(i + 1)) return { v: "iː", next: i + 2 };
      return { v: "i", next: i + 1 };
    case DAMMA:
      if (after(i + 1) === WAW && isBareGlide(i + 1)) return { v: "uː", next: i + 2 };
      return { v: "u", next: i + 1 };
    case SUKUN: return { v: "", next: i + 1 };
    case TANWIN_A: return { v: "an", next: i + 1 };
    case TANWIN_I: return { v: "in", next: i + 1 };
    case TANWIN_U: return { v: "un", next: i + 1 };
    default: return { v: "", next: i }; // no marker
  }
}

/** Scan a fully-diacritized Arabic word into segments (consonants + vowel nuclei). */
export function toSegments(word: string): Seg[] {
  const s = word;
  const n = s.length;
  const segs: Seg[] = [];
  const pushCons = (ph: string): void => { segs.push({ ph, vowel: false }); };
  const pushVowel = (v: string): void => { if (v !== "") segs.push({ ph: v, vowel: true }); };

  let i = 0;
  // Definite article ال- with hamzat-wasl onset (ʔa) + sun/moon assimilation.
  if (s[i] === ALIF && s[i + 1] === "ل") {
    const target = s[i + 2] === undefined ? "" : s[i + 2]!;
    pushCons("ʔ"); pushVowel("a");
    if (SUN.has(target)) i += 2;                 // drop ل; the sun letter geminates (its shadda)
    else { pushCons("l"); i += 2; }              // moon letter keeps l
  } else if (s[i] === ALIF && HARAKAT.has(s[i + 1] ?? "")) {
    pushCons("ʔ");                                // word-initial bare alif + harakat = glottal onset
    const { v, next } = readVowel(s, i + 1); pushVowel(v); i = next;
  } else if (s[i] === ALIF_MADDA) {
    pushCons("ʔ"); pushVowel("aː"); i += 1;
  }

  while (i < n) {
    const c = s[i]!;
    if (CONS[c] !== undefined) {
      let ph = CONS[c]!;
      i++;
      let shadda = false;
      if (s[i] === SHADDA) { shadda = true; i++; }         // C + shadda + harakat (standard order)
      const { v, next } = readVowel(s, i);
      i = next;
      if (s[i] === SHADDA) { shadda = true; i++; }         // C + harakat + shadda (alternate order)
      if (shadda) ph += "ː";                               // gemination → length mark Cː (consistent; espeak vacillates CC/Cː)
      pushCons(ph);
      pushVowel(v);
    } else if (c === ALIF_MADDA) { pushCons("ʔ"); pushVowel("aː"); i++; }
    else if (c === ALIF || c === ALIF_MAQSURA) {          // bare alif after a consonant = long aː (accusative alif تحريما)
      const prev = segs[segs.length - 1];
      if (prev && !prev.vowel) pushVowel("aː");
      i++;
    }
    else if (c === TAA_MARBUTA) { i++; }                 // taː marbuːta: silent in pausal form (the preceding fatḥa is the ending)
    else { i++; }                                        // harakat already consumed / unknown → skip
  }
  return segs;
}

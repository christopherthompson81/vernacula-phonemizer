/**
 * Kazakh (kk) grapheme→phoneme engine — Cyrillic, canonical IPA, espeak-independent. Kazakh Cyrillic is a
 * shallow near-1:1 orthography, so this is a left-to-right scan with a few context rules — no lexicon:
 *   - vowels: а ә е о ө ұ ү ы і э → ɑ æ e o ɵ ʊ ʏ ə ɪ ɛ. Word-INITIAL е → je (ел→jel); elsewhere e.
 *   - iotated / glide letters: и → əj (a diphthong; и=@j in espeak), у → w (glide, not a nucleus:
 *     су→sw), я → ja, ю → ju, ё → jo.
 *   - consonants are context-free except л, which is DARK ɫ next to a back vowel (а о ұ ы) and clear l next to
 *     a front vowel (ә е ө ү і э) — the ɫ census contribution. г→ɡ and к→k do NOT palatalize (unlike Turkish).
 *   - relabels vs espeak-mode: ғ→ʁ (uvular), х→χ, р→r (not the tap), ү→ʏ. щ→ʃʃ, ц→t͡s, ч→t͡ʃ. ъ/ь→ʔ.
 *   - doubled consonants stay doubled (кк→kk, сс→ss); Kazakh has no gemination-to-length.
 * Stress (espeak's STRESSPOSN_1RU) is applied downstream in kazakh.ts. See docs/kk_native_bringup_investigation.md.
 */

// Nucleus vowels (glides w/j are not nuclei). ə (from ы and from и=əj) is the only "unstressed" vowel — see kazakh.ts.
const VOWEL_IPA: Record<string, string> = {
  "а": "ɑ", "ә": "æ", "е": "e", "о": "o", "ө": "ɵ", "ұ": "ʊ", "ү": "ʏ", "ы": "ə", "і": "ɪ", "э": "ɛ",
};
// Iotated / glide letters expand to a fixed IPA sequence (the vowel part is the nucleus).
const GLIDE_IPA: Record<string, string> = { "и": "əj", "у": "w", "я": "ja", "ю": "ju", "ё": "jo" };
const CONS_IPA: Record<string, string> = {
  "б": "b", "в": "v", "г": "ɡ", "ғ": "ʁ", "д": "d", "ж": "ʒ", "з": "z", "й": "j", "к": "k", "қ": "q",
  "м": "m", "н": "n", "ң": "ŋ", "п": "p", "р": "r", "с": "s", "т": "t", "ф": "f", "х": "χ", "һ": "h",
  "ц": "t͡s", "ч": "t͡ʃ", "ш": "ʃ", "щ": "ʃʃ", "ъ": "ʔ", "ь": "ʔ",
};
export interface Seg { ph: string; nucleus: boolean }

/** Kazakh word → IPA segment list (nucleus flags drive stress). */
export function toSegments(word: string): Seg[] {
  const chars = [...word.toLowerCase()];
  const segs: Seg[] = [];
  let prevVowel = ""; // last vowel LETTER seen (for l-darkness)
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]!;
    const next = chars[i + 1] ?? "";
    // Plain vowel. Word-initial е → je: the j is a separate glide so stress lands on the vowel (ел→jˈel).
    if (c in VOWEL_IPA) {
      if (c === "е" && i === 0) segs.push({ ph: "j", nucleus: false });
      segs.push({ ph: VOWEL_IPA[c]!, nucleus: true });
      prevVowel = c;
      continue;
    }
    // Iotated / glide letter.
    if (c in GLIDE_IPA) {
      const ph = GLIDE_IPA[c]!;
      // у is a pure glide (no nucleus); и/я/ю/ё carry a vowel nucleus.
      if (c === "у") segs.push({ ph, nucleus: false });
      else { for (const p of ph) segs.push({ ph: p, nucleus: /[əauo]/u.test(p) }); } // əj/ja/ju/jo: vowel is the nucleus
      prevVowel = c;
      continue;
    }
    // l: emitted DARK ɫ here; kazakh.ts lightens ɫ→l word-wide when the token carries a front vowel (Kazakh
    // vowel harmony — a word is uniformly front or back).
    if (c === "л") { segs.push({ ph: "ɫ", nucleus: false }); continue; }
    const cons = CONS_IPA[c];
    if (cons !== undefined) segs.push({ ph: cons, nucleus: false });
    // else: unknown char (punctuation) → skip
  }
  return segs;
}

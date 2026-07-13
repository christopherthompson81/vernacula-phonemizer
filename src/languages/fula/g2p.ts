/**
 * Fula (ff) grapheme→phoneme engine — Fulfulde, espeak-independent and AUTHORED beyond-espeak (espeak ships no
 * Fula). Latin/Adlam-Latin orthography is shallow, so a longest-match scan: prenasalized digraphs (mb→ᵐb,
 * nd→ⁿd, nj→ⁿd͡ʒ, ng→ᵑɡ; nng→ŋːɡ) and geminates (Cː) resolve before the bare letter. Sole census provider of the
 * implosives ʄ (ƴ) / ɠ, plus ɓ ɗ and the prenasalized series. Stress is penultimate.
 * See docs/ff_native_bringup_investigation.md.
 */

// Orthography → IPA, longest-match. `nuc` = a vowel nucleus (for stress).
const RULES: [string, string, boolean][] = [
  ["nng", "ŋːɡ", false],
  // prenasalized + palatal-nasal digraphs
  ["mb", "ᵐb", false], ["nd", "ⁿd", false], ["nj", "ⁿd͡ʒ", false], ["ng", "ᵑɡ", false], ["ny", "ɲ", false],
  // long vowels
  ["aa", "aː", true], ["ee", "eː", true], ["ii", "iː", true], ["oo", "oː", true], ["uu", "uː", true],
  // geminate consonants
  ["bb", "bː", false], ["pp", "pː", false], ["tt", "tː", false], ["dd", "dː", false], ["cc", "t͡ʃː", false],
  ["jj", "d͡ʒː", false], ["kk", "kː", false], ["gg", "ɡː", false], ["ff", "fː", false], ["ss", "sː", false],
  ["mm", "mː", false], ["nn", "nː", false], ["rr", "ɾː", false], ["ll", "lː", false], ["ww", "wː", false],
  ["yy", "jː", false], ["ɓɓ", "ɓː", false], ["ɗɗ", "ɗː", false], ["ƴƴ", "ʄː", false],
  // single vowels
  ["a", "a", true], ["e", "e", true], ["i", "i", true], ["o", "o", true], ["u", "u", true],
  // single consonants
  ["b", "b", false], ["p", "p", false], ["t", "t", false], ["d", "d", false], ["c", "t͡ʃ", false],
  ["j", "d͡ʒ", false], ["k", "k", false], ["g", "ɡ", false], ["f", "f", false], ["s", "s", false],
  ["h", "h", false], ["m", "m", false], ["n", "n", false], ["ŋ", "ŋ", false], ["ɲ", "ɲ", false],
  ["ñ", "ɲ", false], ["r", "ɾ", false], ["l", "l", false], ["w", "w", false], ["y", "j", false],
  ["ɓ", "ɓ", false], ["ɗ", "ɗ", false], ["ɠ", "ɠ", false], ["ƴ", "ʄ", false], ["q", "ʔ", false],
];

interface Seg { ph: string; nuc: boolean }

/** Scan Fula orthography into IPA segments (longest-match). */
function toSegments(word: string): Seg[] {
  const w = word.toLowerCase();
  const segs: Seg[] = [];
  let i = 0;
  outer: while (i < w.length) {
    for (const [orth, ipa, nuc] of RULES) {
      if (w.startsWith(orth, i)) { segs.push({ ph: ipa, nuc }); i += orth.length; continue outer; }
    }
    i++; // unknown char
  }
  return segs;
}

/** One Fula word → canonical IPA with penultimate stress. */
export function phonemizeWord(word: string): string {
  const segs = toSegments(word);
  const nucIdx = segs.map((s, i) => (s.nuc ? i : -1)).filter((i) => i >= 0);
  if (nucIdx.length === 0) return segs.map((s) => s.ph).join("");
  const stressIdx = nucIdx.length >= 2 ? nucIdx[nucIdx.length - 2]! : nucIdx[0]!; // penultimate nucleus
  let out = "";
  for (let i = 0; i < segs.length; i++) {
    if (i === stressIdx) out += "ˈ";
    out += segs[i]!.ph;
  }
  return out;
}

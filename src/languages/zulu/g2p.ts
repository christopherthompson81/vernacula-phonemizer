/**
 * Zulu (zu, isiZulu) grapheme→phoneme engine — Nguni Bantu, Latin script, AUTHORED beyond-espeak (espeak ships
 * only a crude "testing" voice; no click phoneme exists in espeak). A near-clone of Xhosa. Orthography is a
 * longest-match scan (trigraphs/digraphs before the bare letter) so clicks and affricates resolve as single
 * phonemes with no stray-letter leakage. IPA + phoneme inventory ported from espeak-ng-portable's authored
 * authoring/zu/{zu_rules,ph_zulu} (epitran zul-Latn + kaikki referees). Fills the census click gaps ǀ ǃ ǁ.
 *   - 15-way click series: c/q/x → kǀ/kǃ/kǁ, aspirated ch/qh/xh, voiced-depressor gc/gq/gx (ɡ̤ǀ…),
 *     nasal nc/nq/nx (ŋǀ…), breathy-nasal ngc/ngq/ngx (ŋ̤ǀ…), ejective-nasal nkc/nkq/nkx (ŋǀʼ…).
 *   - implosive b → ɓ (plain b only after m: mb=[mb]); plain voiceless stops are EJECTIVE (p/t/k → pʼ/tʼ/kʼ),
 *     aspirates ph/th/kh → pʰ/tʰ/kʰ; voiced obstruents carry the depressor (breathy) diacritic (g→ɡ̤, d→d̤, z→z̤).
 *   - lateral fricatives hl→ɬ, dl→ɮ̤; velar-lateral affricate kl→kxʼ; nasal place-assimilation n→ŋ/ɲ before
 *     velar/palatal (nk→ŋkʼ, nj→ɲdʒ̤, ng→ŋɡ̤).
 * Penultimate stress + length and lexical tone are applied downstream in zulu.ts. See docs/zu_native_bringup_investigation.md.
 */

// Orthography → IPA, longest-match (multi-char keys tried first). `v` = the unit is a vowel nucleus.
const RULES: [string, string, boolean][] = [
  // 4-char
  ["tshh", "t͡ʃʰ", false], ["thsh", "t͡ʃʰ", false], ["ntsh", "ɲt͡ʃʼ", false],
  // 3-char
  ["nkc", "ŋǀʼ", false], ["nkx", "ŋǁʼ", false], ["nkq", "ŋǃʼ", false],
  ["ngc", "ŋ̤ǀ", false], ["ngx", "ŋ̤ǁ", false], ["ngq", "ŋ̤ǃ", false],
  ["tsh", "t͡ʃʼ", false], ["ths", "t͡sʰ", false], ["tyh", "cʰ", false],
  // 2-char
  ["bh", "b̤", false], ["ch", "kǀʰ", false], ["dl", "ɮ̤", false], ["dy", "ɟ̤", false],
  ["gc", "ɡ̤ǀ", false], ["gx", "ɡ̤ǁ", false], ["gq", "ɡ̤ǃ", false], ["gr", "ɣ̤", false],
  ["hh", "ɦ̤", false], ["hl", "ɬ", false], ["kh", "kʰ", false], ["kl", "k͡xʼ", false],
  ["mb", "mb", false], ["nc", "ŋǀ", false], ["nx", "ŋǁ", false], ["nq", "ŋǃ", false],
  ["ng", "ŋɡ̤", false], ["ny", "ɲ", false], ["nj", "ɲd͡ʒ̤", false], ["nk", "ŋkʼ", false],
  ["ph", "pʰ", false], ["qh", "kǃʰ", false], ["sh", "ʃ", false], ["th", "tʰ", false],
  ["ts", "t͡sʼ", false], ["ty", "cʼ", false], ["xh", "kǁʰ", false],
  // 1-char vowels
  ["a", "a", true], ["e", "ɛ", true], ["i", "i", true], ["o", "ɔ", true], ["u", "u", true],
  // 1-char consonants
  ["b", "ɓ", false], ["c", "kǀ", false], ["d", "d̤", false], ["f", "f", false], ["g", "ɡ̤", false],
  ["h", "h", false], ["j", "d͡ʒ̤", false], ["k", "kʼ", false], ["l", "l", false], ["m", "m", false],
  ["n", "n", false], ["p", "pʼ", false], ["q", "kǃ", false], ["r", "r", false], ["s", "s", false],
  ["t", "tʼ", false], ["v", "v̤", false], ["w", "w", false], ["x", "kǁ", false], ["y", "j", false],
  ["z", "z̤", false],
];

export interface Seg { ph: string; v: boolean }

/** Scan Zulu orthography into IPA segments (longest-match). */
export function toSegments(word: string): Seg[] {
  const w = word.toLowerCase();
  const segs: Seg[] = [];
  let i = 0;
  outer: while (i < w.length) {
    // Word-initial ntsh keeps a plain n (Ntshonalanga→nt͡ʃʼ); the n→ɲ palatalization only fires medially.
    if (i === 0 && w.startsWith("ntsh")) { segs.push({ ph: "n", v: false }, { ph: "t͡ʃʼ", v: false }); i += 4; continue; }
    for (const [orth, ipa, v] of RULES) {
      if (w.startsWith(orth, i)) { segs.push({ ph: ipa, v }); i += orth.length; continue outer; }
    }
    i++; // unknown char (skip)
  }
  return segs;
}

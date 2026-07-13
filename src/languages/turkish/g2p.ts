/**
 * Turkish grapheme→phoneme engine. Turkish orthography is shallow and near-1:1 (vowel harmony is already
 * encoded in the spelling), so this is a left-to-right scan with a few context rules — no lexicon:
 *   - vowels are phonemic: a e ı i o ö u ü → a e ɯ i o ø u y (front = e i ö ü, back = a ı o u).
 *   - k/g palatalize before a FRONT vowel: k→c always (asker→asceɾ); g→ɟ only when not after a consonant
 *     (gel→ɟel but bölge→bølɡe).
 *   - l is DARK ɫ next to a back vowel, clear l next to a front vowel (okul→okuɫ, dil→dil) — the ɫ census
 *     contribution.
 *   - ğ (yumuşak g) after e/i → j glide (değil→dejil); elsewhere it lengthens the preceding vowel and a
 *     following identical vowel merges (dağ→daː, soğuk→soːuk, düğün→dyːn).
 *   - a doubled consonant geminates to Cː (teşekkür→teʃekːyɾ).
 * Stress (final-syllable default + a lexicon) and number reading are applied downstream. See
 * docs/tr_native_bringup_investigation.md for the convention.
 */

const VOWEL_IPA: Record<string, string> = { a: "a", e: "e", "ı": "ɯ", i: "i", o: "o", "ö": "ø", u: "u", "ü": "y" };
const FRONT = new Set(["e", "i", "ö", "ü"]);
const FRONT_UNROUND = new Set(["e", "i"]);
const BACK = new Set(["a", "ı", "o", "u"]);
// Context-free consonants (g/k/l/ğ are handled specially).
const CONS_IPA: Record<string, string> = {
  b: "b", c: "d͡ʒ", "ç": "t͡ʃ", d: "d", f: "f", h: "h", j: "ʒ", m: "m", n: "n",
  p: "p", r: "ɾ", s: "s", "ş": "ʃ", t: "t", v: "v", y: "j", z: "z",
  w: "w", x: "ks", q: "k", // foreign letters (loanwords: web → web)
};
// Doubled STOPS/affricates geminate to Cː (teşekkür→teʃekːyɾ, dikkat→dikːat); doubled sonorants/fricatives
// stay written double (allah→aɫɫah, anne→anne).
const GEMINATE = new Set(["p", "t", "k", "b", "d", "c", "ç"]);
const isVowel = (c: string): boolean => c !== "" && c in VOWEL_IPA;

export interface Seg {
  ph: string;       // IPA phoneme(s)
  nucleus: boolean; // is a syllable nucleus (a vowel)
}

/** Turkish-locale lowercase: İ→i and I→ı (JS toLowerCase would give i̇ / i). Then fold circumflex â/î/û→a/i/u. */
export function trLower(word: string): string {
  return word.replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase().replace(/[âîû]/g, (c) => ({ "â": "a", "î": "i", "û": "u" }[c] ?? c));
}

/** Turkish word → segment list. */
export function toSegments(word: string): Seg[] {
  const chars = [...trLower(word)];
  const segs: Seg[] = [];
  let prevVowel = "";                    // last vowel LETTER seen (for l-darkness / ğ)
  let gMerge = "";                       // a ğ just lengthened this vowel letter; a following same vowel merges
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]!;
    const next = chars[i + 1] ?? "";
    const prevC = chars[i - 1] ?? "";
    // Vowel.
    if (c in VOWEL_IPA) {
      if (gMerge === c && c !== "ı") { gMerge = ""; prevVowel = c; continue; } // ğ-merge: identical vowel folds (ı never merges: yaptığı→ɯːɯ)
      gMerge = "";
      segs.push({ ph: VOWEL_IPA[c]!, nucleus: true });
      prevVowel = c;
      continue;
    }
    gMerge = "";
    // Geminate stop/affricate → length mark (the second of a doubled stop).
    if (c === prevC && GEMINATE.has(c)) { segs.push({ ph: "ː", nucleus: false }); continue; }
    // ğ (yumuşak g).
    if (c === "ğ") {
      if (FRONT_UNROUND.has(prevVowel)) segs.push({ ph: "j", nucleus: false }); // değil → dejil
      else if (segs.length > 0) { segs[segs.length - 1]!.ph += "ː"; gMerge = prevVowel; } // lengthen prev vowel
      continue;
    }
    // l: dark ɫ next to a back vowel, clear l next to a front vowel. Onset l keys on the FOLLOWING vowel,
    // coda l on the PRECEDING vowel.
    if (c === "l") {
      const ctx = isVowel(next) ? next : prevVowel;
      segs.push({ ph: BACK.has(ctx) ? "ɫ" : "l", nucleus: false });
      continue;
    }
    // k → c before a front vowel (asker → asceɾ), else k.
    if (c === "k") { segs.push({ ph: FRONT.has(next) ? "c" : "k", nucleus: false }); continue; }
    // g → ɟ before a front vowel (majority of the gold; the ɡ cases like bölge are lexical), else ɡ.
    if (c === "g") { segs.push({ ph: FRONT.has(next) ? "ɟ" : "ɡ", nucleus: false }); continue; }
    const cons = CONS_IPA[c];
    if (cons !== undefined) segs.push({ ph: cons, nucleus: false });
    // else: unknown char (punctuation slipped in) → skip
  }
  return segs;
}

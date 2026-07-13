/**
 * Japanese kana → canonical IPA (Standard/Tokyo, narrow). Mora-based: gojūon + dakuten/handakuten + youon
 * (きゃ…) + sokuon (っ, gemination) + long vowels (ー, おう→o̞ː, えい→e̞ː) + moraic ん→ɴ. Katakana is folded to
 * hiragana first. Vowels: あ→ä い→i う→ɯᵝ え→e̞ お→o̞. Segmental only — pitch accent is a later phase.
 * See docs/ja_native_bringup_investigation.md.
 */

// Vowels (narrow Tokyo): centralized ä, compressed ɯᵝ, mid-lowered e̞/o̞.
const A = "ä", I = "i", U = "ɯᵝ", E = "e̞", O = "o̞";

// Single-kana → IPA (hiragana keys; katakana folded in first).
const MORA: Record<string, string> = {
  あ: A, い: I, う: U, え: E, お: O,
  か: "k" + A, き: "k" + I, く: "k" + U, け: "k" + E, こ: "k" + O,
  が: "ɡ" + A, ぎ: "ɡ" + I, ぐ: "ɡ" + U, げ: "ɡ" + E, ご: "ɡ" + O,
  さ: "s" + A, し: "ɕ" + I, す: "s" + U, せ: "s" + E, そ: "s" + O,
  ざ: "z" + A, じ: "d͡ʑ" + I, ず: "z" + U, ぜ: "z" + E, ぞ: "z" + O,
  た: "t" + A, ち: "t͡ɕ" + I, つ: "t͡s" + U, て: "t" + E, と: "t" + O,
  だ: "d" + A, ぢ: "d͡ʑ" + I, づ: "z" + U, で: "d" + E, ど: "d" + O,
  な: "n" + A, に: "n" + I, ぬ: "n" + U, ね: "n" + E, の: "n" + O,
  は: "h" + A, ひ: "ç" + I, ふ: "ɸ" + U, へ: "h" + E, ほ: "h" + O,
  ば: "b" + A, び: "b" + I, ぶ: "b" + U, べ: "b" + E, ぼ: "b" + O,
  ぱ: "p" + A, ぴ: "p" + I, ぷ: "p" + U, ぺ: "p" + E, ぽ: "p" + O,
  ま: "m" + A, み: "m" + I, む: "m" + U, め: "m" + E, も: "m" + O,
  や: "j" + A, ゆ: "j" + U, よ: "j" + O,
  ら: "ɾ" + A, り: "ɾ" + I, る: "ɾ" + U, れ: "ɾ" + E, ろ: "ɾ" + O,
  わ: "w" + A, ゐ: "w" + I, ゑ: "w" + E, を: O, ん: "ɴ",
  ぁ: A, ぃ: I, ぅ: U, ぇ: E, ぉ: O, ゔ: "v" + U,
};

// Youon onsets (Ci + small ya/yu/yo). Already-palatal ɕ/t͡ɕ/d͡ʑ/ç take no ʲ; others palatalize.
const YOUON_ONSET: Record<string, string> = {
  き: "kʲ", ぎ: "ɡʲ", し: "ɕ", じ: "d͡ʑ", ち: "t͡ɕ", ぢ: "d͡ʑ", に: "nʲ", ひ: "ç",
  び: "bʲ", ぴ: "pʲ", み: "mʲ", り: "ɾʲ",
};
const SMALL_Y: Record<string, string> = { ゃ: A, ゅ: U, ょ: O };
// Extended (foreign-sound) katakana: a base kana + a small vowel replaces the base's vowel (ファ→ɸä, チェ→t͡ɕe̞).
const FOREIGN: Record<string, string> = {
  ふぁ: "ɸ" + A, ふぃ: "ɸ" + I, ふぇ: "ɸ" + E, ふぉ: "ɸ" + O, ふゅ: "ɸʲ" + U,
  ゔぁ: "v" + A, ゔぃ: "v" + I, ゔぇ: "v" + E, ゔぉ: "v" + O,
  うぃ: "w" + I, うぇ: "w" + E, うぉ: "w" + O, いぇ: "j" + E,
  てぃ: "t" + I, てゅ: "tʲ" + U, でぃ: "d" + I, でゅ: "dʲ" + U, とぅ: "t" + U, どぅ: "d" + U,
  ちぇ: "t͡ɕ" + E, しぇ: "ɕ" + E, じぇ: "d͡ʑ" + E,
  つぁ: "t͡s" + A, つぃ: "t͡s" + I, つぇ: "t͡s" + E, つぉ: "t͡s" + O,
};
// Vowel-continuation kana → their vowel phoneme, for same-vowel lengthening. Small ぁぃぅぇぉ act as casual-text
// prolongations (なぁ→näː). NOTE: を is excluded (see coalescence).
const VOWEL_KANA: Record<string, string> = { あ: A, い: I, う: U, え: E, お: O, ぁ: A, ぃ: I, ぅ: U, ぇ: E, ぉ: O };

/** Fold katakana (and the long mark) to hiragana; leave everything else. */
function toHiragana(w: string): string {
  let out = "";
  for (const ch of w) {
    const c = ch.codePointAt(0)!;
    if (c >= 0x30a1 && c <= 0x30f6) out += String.fromCodePoint(c - 0x60); // カ → か
    else out += ch;
  }
  return out;
}

const isVowelChar = (ph: string): boolean => ph === A || ph === I || ph === U || ph === E || ph === O;
/** The vowel phoneme a mora ends in (ɯᵝ/o̞/e̞ before their bases), or "" for ん/っ/onset-only. */
function vowelOf(ms: string): string {
  for (const v of [U, O, E, A, I]) if (ms.endsWith(v)) return v;
  return "";
}

/**
 * A run of kana → its list of MORAE (one array element per mora: a long vowel ː is its own mora, a moraic ん is
 * its own mora, a sokuon っ its own mora). `join("")` reconstructs the IPA. Keeping morae separate lets the pitch
 * pass place the downstep by index without re-parsing (our assimilated ん→n/m would be ambiguous in the string).
 * Returns null if the text isn't kana (so the caller can handle romaji/punctuation/unresolved kanji).
 */
export function kanaToMorae(word: string): string[] | null {
  const chars = [...toHiragana(word)];
  const morae: string[] = [];
  let i = 0;
  let prevYouon = false;   // the previous mora was a youon (small ゃゅょ) — blocks same-vowel coalescence (see below)
  let lastVowel = "";      // trailing vowel of the current syllable (survives a ː, cleared by ん/っ)
  while (i < chars.length) {
    const c = chars[i]!, nx = chars[i + 1] ?? "";
    // Extended katakana (foreign sounds): base kana + small kana → onset + vowel (ファ→ɸä, チェ→t͡ɕe̞, ディ→di,
    // デュ→dʲɯᵝ). Keys carry the small 2nd kana, so a direct FOREIGN lookup can't shadow a normal mora sequence.
    if (FOREIGN[c + nx]) { const ms = FOREIGN[c + nx]!; morae.push(ms); lastVowel = vowelOf(ms); prevYouon = false; i += 2; continue; }
    // Youon: Ci + small ゃゅょ.
    if (YOUON_ONSET[c] && SMALL_Y[nx]) { const ms = YOUON_ONSET[c]! + SMALL_Y[nx]!; morae.push(ms); lastVowel = vowelOf(ms); prevYouon = true; i += 2; continue; }
    // Sokuon っ → geminate the next mora's first consonant (its own mora). Word-final / vowel-onset → glottal ʔ.
    if (c === "っ" || c === "ッ") {
      const next = SMALL_Y[chars[i + 2] ?? ""] && YOUON_ONSET[nx] ? YOUON_ONSET[nx]! + SMALL_Y[chars[i + 2]!]! : MORA[nx];
      morae.push(next && !isVowelChar(next[0]!) ? next[0]! : "ʔ");
      lastVowel = ""; prevYouon = false; i++; continue;
    }
    // Long vowel mark ー → +1 mora (ː).
    if (c === "ー" || c === "ｰ") { if (morae.length) morae.push("ː"); i++; continue; }
    const m = MORA[c];
    if (m === undefined) return null;      // not kana → let the caller handle (romaji, punctuation, kanji)
    // Long-vowel coalescence, keyed on the CURRENT KANA (not the phoneme): the お+う / え+い digraphs always fold
    // (おう→o̞ː, えい→e̞ː; fires after youon too — きょう→kʲo̞ː). A vowel kana repeating the previous vowel folds
    // (おお→o̞ː, いい→iː) EXCEPT after a youon mora, where espeak keeps the two morae (じゅう→d͡ʑɯᵝɯᵝ, きゅう→kʲɯᵝɯᵝ).
    // A fold pushes a bare ː mora; stacking (けいい→ke̞ːː) works since lastVowel survives the ː. を is EXCLUDED from
    // the same-vowel rule (a distinct kana, near-always the particle): 語を→ɡo̞o̞, never ɡo̞ː.
    if (lastVowel !== "") {
      if (c === "う" && lastVowel === O) { morae.push("ː"); i++; continue; }
      else if (c === "い" && lastVowel === E) { morae.push("ː"); i++; continue; }
      else if (!prevYouon && VOWEL_KANA[c] === lastVowel) { morae.push("ː"); i++; continue; }
    }
    morae.push(m);
    lastVowel = vowelOf(m);
    prevYouon = false;
    i++;
  }
  // Moraic ん assimilates to the following onset's place: n before coronals, ŋ before velars, m before labials,
  // else ɴ (before vowels/glides/fricatives or word-finally): こんにちは→ko̞nni…, にほんご→niho̞ŋɡo̞, さんぽ→sampo̞.
  for (let k = 0; k < morae.length; k++) {
    if (morae[k] !== "ɴ") continue;
    const o = morae[k + 1]?.[0] ?? "";
    if (o === "") continue;                         // word-final ん stays ɴ (guard includes("") trap)
    if ("tdnszɾ".includes(o)) morae[k] = "n";
    else if ("kɡ".includes(o)) morae[k] = "ŋ";
    else if ("pbm".includes(o)) morae[k] = "m";
  }
  return morae;
}

/** A run of kana → IPA. Returns null if the text isn't kana. */
export function kanaToIpa(word: string): string | null {
  const morae = kanaToMorae(word);
  return morae === null ? null : morae.join("");
}

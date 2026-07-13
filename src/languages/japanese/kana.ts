/**
 * Japanese kana → canonical IPA (Standard/Tokyo, narrow). Mora-based: gojūon + dakuten/handakuten + youon
 * (きゃ…) + sokuon (っ, gemination) + long vowels (ー, おう→o̞ː, えい→e̞ː) + moraic ん→ɴ. Katakana is folded to
 * hiragana first. Vowels: あ→ä い→i う→ɯᵝ え→e̞ お→o̞. Segmental only — pitch accent is a later phase.
 * See docs/ja_native_bringup_investigation.md.
 */

import { MANIFEST } from "./manifest.ts";

// Vowels (narrow Tokyo): centralized ä, compressed ɯᵝ, mid-lowered e̞/o̞. Lookup tables are DATA (japanese.jsonc).
const A = MANIFEST.vowels.a!, I = MANIFEST.vowels.i!, U = MANIFEST.vowels.u!, E = MANIFEST.vowels.e!, O = MANIFEST.vowels.o!;
const MORA = MANIFEST.mora;                 // single kana → IPA mora
const YOUON_ONSET = MANIFEST.youonOnset;    // Ci + small ゃゅょ onset (already-palatal ɕ/t͡ɕ/d͡ʑ/ç take no ʲ)
const SMALL_Y = MANIFEST.smallY;            // the small ゃゅょ vowel
const FOREIGN = MANIFEST.foreign;           // extended (foreign-sound) katakana: base + small kana → onset + vowel
const VOWEL_KANA = MANIFEST.vowelKana;      // vowel-continuation kana for same-vowel lengthening (を excluded)
const NASAL_ASSIM = MANIFEST.nasalAssimilation; // moraic ん → place-assimilated nasal by next onset

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
    for (const cls of NASAL_ASSIM) if (cls.onsets.includes(o)) { morae[k] = cls.nasal; break; }
  }
  return morae;
}

/** A run of kana → IPA. Returns null if the text isn't kana. */
export function kanaToIpa(word: string): string | null {
  const morae = kanaToMorae(word);
  return morae === null ? null : morae.join("");
}

/**
 * Traditional Mongolian script (Mongol bichig, Unicode U+1800–U+18AF) → Cyrillic FRONT-END. Mongol bichig is a deep
 * HISTORICAL orthography (far deeper than Cyrillic): it preserves classical forms whose intervocalic velars ɣ/g have
 * since deleted with vowel contraction (ᠠᠭᠤᠯᠠ aɣula → modern уул [uːɮ]; ᠡᠭᠦᠳᠡ egüde → үүд). Rather than a second deep
 * engine, this transliterates each glyph to its Cyrillic base reading and feeds the existing Cyrillic phonemizer —
 * so the segmental/harmony/reduction machinery is reused. The classical→modern CONTRACTION layer (intervocalic
 * ɣ/g-deletion + long-vowel coalescence) is applied as a light rule pass on the transliteration; the residual is
 * lexical (which vowel wins a contraction isn't fully predictable).
 */

// Base glyph → Cyrillic. Vowels carry known ambiguities (ᠣ o~u, ᠥ ö~ü) — we take the base value and let contraction
// + the Cyrillic engine handle the rest. Free-variation selectors / joiners / MVS are stripped (handled by filter).
const GLYPH: Record<string, string> = {
    "ᠠ": "а", "ᠡ": "э", "ᠢ": "и", "ᠣ": "о", "ᠤ": "у", "ᠥ": "ө", "ᠦ": "ү",
    "ᠧ": "э", // ᠧ ee
    "ᠨ": "н", "ᠩ": "н", // ᠨ n, ᠩ ng → н (final н→ŋ handled downstream)
    "ᠪ": "б", "ᠫ": "п", "ᠬ": "х", "ᠭ": "г", "ᠮ": "м", "ᠯ": "л",
    "ᠰ": "с", "ᠱ": "ш", "ᠲ": "т", "ᠳ": "д", "ᠴ": "ч", "ᠵ": "ж",
    "ᠶ": "й", "ᠷ": "р", "ᠸ": "в", "ᠹ": "ф", "ᠺ": "к", "ᠻ": "х",
    "ᠼ": "ц", "ᠽ": "з", "ᠾ": "х", // ᠾ h → х
};
// Zero-width joiners, MVS (U+180E), free-variation selectors U+180B–180D, NNBSP — carry no phonemic value.
const IGNORE = /[\u180B-\u180E\u200C\u200D\u202F]/gu;

/** Transliterate a Mongol-bichig word to a Cyrillic string (base readings) + the classical→modern contraction rule.
 *  A non-bichig char (e.g. a Cyrillic letter in a mixed-script token) is passed through unchanged, not dropped. */
export function bichigToCyrillic(word: string): string {
    let cyr = "";
    for (const ch of word.replace(IGNORE, "")) cyr += GLYPH[ch] ?? ch; // pass a non-bichig char through (mixed-script token)
    // Classical→modern CONTRACTION: an intervocalic ⟨г⟩ (classical ɣ/g) between two vowels deletes and the vowels
    // coalesce into a LONG vowel of the SECOND vowel's quality (аɣула→ауула→уул; эгүдэ→эүүдэ→үүд). Approximated as
    // V г V → the doubled second vowel (the Cyrillic engine reads a doubled vowel as long). ⟨х⟩ (classical q) does NOT
    // delete (ᠠᠬᠤᠢ aqui → axʊi keeps it), so the rule is ⟨г⟩-only. Looped to stability for multiple intervocalic ⟨г⟩.
    let prev: string;
    do { prev = cyr; cyr = cyr.replace(/([аэиоуөү])г([аэиоуөү])/gu, (_m, _v1, v2) => v2 + v2); } while (cyr !== prev);
    return cyr;
}

/** Is this string in the traditional Mongolian script block (so it needs the bichig front-end)? */
export const isBichig = (s: string): boolean => /[ᠠ-ᡂ]/u.test(s);

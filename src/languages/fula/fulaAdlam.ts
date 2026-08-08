/**
 * Adlam (𞤀𞤁𞤂𞤃, U+1E900–1E95F) → Fula Boko/Latin transliteration — the second-script front-end for Fula (ff), the
 * Tashelhit/Tifinagh pattern. Adlam is the modern (1989, the Barry brothers) phonemic alphabet for Fulfulde/Pular,
 * now in wide diaspora + West-African use. Each Adlam letter maps 1:1 to a Fula phoneme, so we transliterate Adlam →
 * the Latin (Boko) orthography and reuse the existing longest-match g2p (g2p.ts) — prenasalisation (a nasal letter +
 * stop → mb/nd/nj/ng), gemination and vowel length all fall out of the same Latin rules.
 *
 * Adlam is caseless for phonemics (we fold the uppercase U+1E900–1E921 onto the lowercase U+1E922–1E943) and marks
 * length / gemination with COMBINING marks rather than doubling — so the VOWEL/ALIF LENGTHENER doubles the preceding
 * vowel (𞤢𞥅 → "aa" → [aː]) and the GEMINATION MARK doubles the preceding consonant (𞤦𞥆 → "bb" → [bː]); HAMZA →
 * the glottal ⟨q⟩→[ʔ]; the CONSONANT MODIFIER / GEMINATE-CONSONANT-MODIFIER / NUKTA (rare foreign-sound marks) are
 * dropped. The extra loan letters (va x gb z kp sh) transliterate to their Boko equivalents — identical to how the
 * Latin engine already treats them, so the two scripts stay consistent.
 */

// Adlam SMALL LETTER (U+1E922–1E943) → Fula Boko/Latin. Uppercase (U+1E900–1E921) folds here by the −0x22 offset.
const ADLAM: Record<string, string> = {
    "𞤢": "a", "𞤣": "d", "𞤤": "l", "𞤥": "m", "𞤦": "b", "𞤧": "s", "𞤨": "p", "𞤩": "ɓ", "𞤪": "r", "𞤫": "e",
    "𞤬": "f", "𞤭": "i", "𞤮": "o", "𞤯": "ɗ", "𞤰": "ƴ", "𞤱": "w", "𞤲": "n", "𞤳": "k", "𞤴": "y", "𞤵": "u",
    "𞤶": "j", "𞤷": "c", "𞤸": "h", "𞤹": "q", "𞤺": "g", "𞤻": "ny", "𞤼": "t", "𞤽": "ŋ", "𞤾": "v", "𞤿": "x",
    "𞥀": "gb", "𞥁": "z", "𞥂": "kp", "𞥃": "sh",
};
const DIGITS: Record<string, string> = { "𞥐": "0", "𞥑": "1", "𞥒": "2", "𞥓": "3", "𞥔": "4", "𞥕": "5", "𞥖": "6", "𞥗": "7", "𞥘": "8", "𞥙": "9" };
const LENGTHENER = new Set(["\u{1E944}", "\u{1E945}"]); // ALIF / VOWEL LENGTHENER → double the preceding vowel
const GEMINATION = "\u{1E946}"; // GEMINATION MARK → double the preceding consonant
const HAMZA = "\u{1E947}"; // → the glottal ⟨q⟩ ([ʔ] in the g2p)
const DROP = new Set(["\u{1E948}", "\u{1E949}", "\u{1E94A}"]); // CONSONANT MODIFIER / GEMINATE MOD / NUKTA (foreign)
// ⚠ ORTHOGRAPHIC, NOT IPA — adlamToLatin emits the Latin SPELLING, and the lengthener doubles a
// spelled vowel. Not core/ipa.ts.
const VOWELS = new Set([..."aeiou"]);

/** Is any character of `s` in the Adlam block (U+1E900–1E95F)? */
export function isAdlam(s: string): boolean {
    for (const ch of s) { const c = ch.codePointAt(0)!; if (c >= 0x1e900 && c <= 0x1e95f) return true; }
    return false;
}

/** Fold an Adlam char to its lowercase form (uppercase U+1E900–1E921 → lowercase U+1E922–1E943). */
function toLower(ch: string): string {
    const c = ch.codePointAt(0)!;
    return c >= 0x1e900 && c <= 0x1e921 ? String.fromCodePoint(c + 0x22) : ch;
}

/** Transliterate an Adlam word → the Fula Boko/Latin orthography (then the caller runs the normal g2p). */
export function adlamToLatin(word: string): string {
    let out = "";
    let lastBase = ""; // the Latin emitted for the previous base letter (for gemination doubling)
    for (const raw of word) {
        const ch = toLower(raw);
        if (LENGTHENER.has(ch)) { const v = out.at(-1); if (v && VOWELS.has(v)) out += v; continue; }
        if (ch === GEMINATION) { out += lastBase; continue; }
        if (ch === HAMZA) { out += "q"; lastBase = "q"; continue; }
        if (DROP.has(ch)) continue;
        const lat = ADLAM[ch] ?? DIGITS[ch];
        if (lat !== undefined) { out += lat; lastBase = lat; } else out += raw; // pass unknown through
    }
    return out;
}

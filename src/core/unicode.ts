/**
 * Notation-parsing PRIMITIVES for the native abugida path — pure Unicode/IPA facts about HOW to read
 * the string (which codepoints are vowels, modifiers, tie bars, digits; which block is a script). These
 * are code constants, NOT declarative data: they don't decide which phoneme is produced (that lives in
 * data/native/_shared/phonology.jsonc + the per-language JSONC) — they only classify characters while
 * tokenizing. Regexes that match a SET are built from the string lists here at the use site, so the list
 * is the single source and the pattern is derived from it. One obvious mirror target for the C# port.
 */

/** Combining diacritics block U+0300–U+036F (̀-ͯ): attach to the preceding base (nasal ◌̃, dental ◌̪). */
export const COMBINING_DIACRITICS = "̀-ͯ";

/** Tie bar U+0361 (͡): joins the two halves of an affricate (t͡ʃ, d͡ʑ) into one token. */
export const TIE_BAR = "͡";

/** IPA spacing modifiers that attach to the preceding unit: length ː ˑ, palatalization ʲ, aspiration ʰ,
 *  breathy ʱ, ejective ʼ. (Combined with {@link COMBINING_DIACRITICS} to form the tokenizer's MOD set.) */
export const ATTACHING_MODIFIERS = "ːˑʲʰʱʼ";

/** IPA vowel letters — the universal alphabet the stress tokenizer treats as syllable nuclei. A vowel is
 *  a vowel regardless of which language declares it, so this is a notation constant, not per-language data. */
export const IPA_VOWELS = "əaeiouɪʊɛɔɐæyøɘɤʌɯɵœɜɞʉɨɶ";

/** Primary / secondary stress marks (IPA). */
export const STRESS_PRIMARY = "ˈ";
export const STRESS_SECONDARY = "ˌ";

/** Devanagari block U+0900–U+097F (ऀ-ॿ) — script detection. */
export const DEVANAGARI_BLOCK = "ऀ-ॿ";

/** Word-forming Devanagari: letters + signs + vocalic extensions, EXCLUDING the digits (U+0966–096F)
 *  and the danda/punctuation — i.e. ऀ-ॣ (U+0900–0963) + ॲ-ॿ (U+0972–097F). Used to split text into
 *  word runs so a digit run breaks out as its own (number) token. */
export const DEVANAGARI_WORD = "ऀ-ॣॲ-ॿ";

/** Devanagari digits ०-९ → ASCII, for number parsing. The regex digit-class is built from these keys. */
export const DEVANAGARI_DIGITS: Record<string, string> = {
    "०": "0",
    "१": "1",
    "२": "2",
    "३": "3",
    "४": "4",
    "५": "5",
    "६": "6",
    "७": "7",
    "८": "8",
    "९": "9",
};

/** Word-forming Bengali (U+0980 block): letters + signs + matras + vocalic, EXCLUDING the digits
 *  (U+09E6–09EF) and punctuation — i.e. ঀ-ৣ (U+0980–09E3) + ৰ-৾ (U+09F0–09FE, ra/wa variants + signs).
 *  Bengali uses the shared danda । (U+0964) for clause punctuation, handled separately. */
export const BENGALI_WORD = "ঀ-ৣৰ-৾";

// Gujarati block (U+0A80–U+0AFF) minus the digit range — a word run.
export const GUJARATI_WORD = "઀-૥૰-૿";

/** Gujarati digits ૦-૯ → ASCII, for number parsing. */
export const GUJARATI_DIGITS: Record<string, string> = {
    "૦": "0",
    "૧": "1",
    "૨": "2",
    "૩": "3",
    "૪": "4",
    "૫": "5",
    "૬": "6",
    "૭": "7",
    "૮": "8",
    "૯": "9",
};

/** Bengali digits ০-৯ → ASCII, for number parsing. */
export const BENGALI_DIGITS: Record<string, string> = {
    "০": "0",
    "১": "1",
    "২": "2",
    "৩": "3",
    "৪": "4",
    "৫": "5",
    "৬": "6",
    "৭": "7",
    "৮": "8",
    "৯": "9",
};

/** Latin letters that have no combining-mark decomposition, so NFD alone cannot fold them. */
const LATIN_ATOMIC: Record<string, string> = {
    ø: "o", æ: "ae", œ: "oe", ß: "ss", ł: "l", đ: "d", ð: "d", þ: "th", ħ: "h", ı: "i", ŋ: "ng",
};

/**
 * Fold Latin diacritics to the ASCII base letters an English-style lexicon and G2P are trained on:
 * café → cafe, naïve → naive, jalapeño → jalapeno, résumé → resume.
 *
 * Needed because a dictionary keyed on ASCII has no entry for the accented spelling — CMUdict has
 * `cafe`, `naive`, `jalapeno` and `resume` but none of their accented forms — so without folding, a
 * loanword either misses the lexicon or (worse) is split at the accent by an ASCII-only tokenizer.
 *
 * Lossy by design where the accent is the only distinction: résumé and resume fold together, so the
 * noun inherits the verb's reading. That is a documented conflation, and far better than the
 * alternative of mangling the word.
 */
export function foldLatinDiacritics(s: string): string {
    const stripped = s.normalize("NFD").replace(/\p{M}+/gu, "");
    return stripped.replace(/[øæœßłđðþħıŋ]/gu, (c) => LATIN_ATOMIC[c] ?? c);
}

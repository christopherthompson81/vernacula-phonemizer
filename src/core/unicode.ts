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

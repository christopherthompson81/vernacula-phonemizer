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

/**
 * Decimal-digit block bases for every script this project supports. Unicode guarantees a decimal digit
 * block is ten contiguous codepoints in ascending value, so the fold below is arithmetic rather than a
 * per-script table of ten entries each.
 */
const NATIVE_DIGIT_BASES: readonly number[] = [
    0x0660, // Arabic-Indic
    0x06f0, // Extended Arabic-Indic (Persian, Urdu)
    0x0966, // Devanagari
    0x09e6, // Bengali
    0x0a66, // Gurmukhi
    0x0ae6, // Gujarati
    0x0b66, // Odia
    0x0be6, // Tamil
    0x0c66, // Telugu
    0x0ce6, // Kannada
    0x0d66, // Malayalam
    0x0de6, // Sinhala
    0x0e50, // Thai
    0x0ed0, // Lao
    0x0f20, // Tibetan
    0x1040, // Myanmar
    0x17e0, // Khmer
    0xff10, // Fullwidth
];

/**
 * Fold any script's own decimal digits to ASCII, so the number path can read them.
 *
 * WHY: an engine whose number token is `\d+` (ASCII-only, as JavaScript defines it) sees a numeral written
 * in the language's own digits as no token at all, and `assembleClauses` skips what the tokenizer declines
 * — so the number VANISHES. Auditing 21 scripts found six engines returning an EMPTY STRING for their own
 * numerals: Punjabi, Tamil, Telugu, Malayalam, Sinhala and Lao. Total content loss, silent.
 *
 * Applied per engine rather than fleet-wide at the registry, deliberately: Telugu's corpus uses ౦ (U+0C66,
 * its digit zero) as a HOMOGLYPH for ం (sunna) in 144 places, so a blanket fold ahead of Telugu's own
 * homoglyph rule would corrupt exactly the language that found the problem. Ordering has to stay the
 * language's decision.
 */
export function foldNativeDigits(s: string): string {
    return s.replace(/\p{Nd}/gu, (ch) => {
        const cp = ch.codePointAt(0)!;
        if (cp < 0x80) return ch; // already ASCII
        for (const base of NATIVE_DIGIT_BASES)
            if (cp >= base && cp <= base + 9) return String(cp - base);
        return ch; // a block we do not carry: leave it rather than guess
    });
}

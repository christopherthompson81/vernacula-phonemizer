/**
 * Notation-parsing PRIMITIVES for the native abugida path — pure Unicode/IPA facts about HOW to read
 * the string (which codepoints are vowels, modifiers, tie bars, digits; which block is a script). These
 * are code constants, NOT declarative data: they don't decide which phoneme is produced (that lives in
 * `phonology.jsonc` beside this module, plus the per-language JSONC) — they only classify characters while
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
 *  a vowel regardless of which language declares it, so this is a notation constant, not per-language data.
 *  ⚠ RE-EXPORTED, NOT DEFINED HERE: core/ipa.ts owns the phone classes, and 31 engines now read the same
 *  one. Kept exported from unicode.ts so the existing regex users need not care where it moved. */
export { IPA_VOWELS } from "./ipa.ts";

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
    0x07c0, // Nko
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
    0x1090, // Myanmar Shan
    0x17e0, // Khmer
    0x1bb0, // Sundanese
    0x1c50, // Ol Chiki
    0xa9d0, // Javanese
    0x1e950, // Adlam
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
 * ⚠ APPLIED FLEET-WIDE AT THE REGISTRY, with an opt-out list — this comment used to say the opposite and
 * was stale. `registry.ts` calls this on every `text()`/`phonemize()` through the shadow wrapper, so the
 * ASCII `\d` in every downstream normalizer is reading a string whose native digits are already ASCII.
 * That single fact is what makes the fleet's ~386 ASCII digit classes correct rather than blind, and it
 * is worth stating here because this is the file a reader checks when they doubt one of them.
 *
 * THE OPT-OUT IS THE ORIGINAL PER-ENGINE ARGUMENT, narrowed to the one language that earned it: Telugu's
 * corpus uses ౦ (U+0C66, its digit zero) as a HOMOGLYPH for ం (sunna) in 144 places, so a blanket fold
 * ahead of Telugu's own homoglyph rule would corrupt exactly the language that found the problem. `te` is
 * therefore in `FOLD_OPT_OUT` and folds inside its own normalize.ts, after the homoglyph rule. The dozen
 * per-language folds that predate the registry one stay: folding is idempotent.
 *
 * ⚠ AND IT RUNS LAST AMONG THE REPAIRS, which is a live ordering constraint rather than a detail. Every
 * fold composed around it in `registry.ts` — the caret exponents, the vulgar fractions, the markup strip —
 * sees the string BEFORE this one has run, so an ASCII-only digit guard inside any of them is blind to a
 * native digit. Rare in the corpora and left as-is, but it is the reason a `\d` in this file is not
 * automatically as safe as a `\d` in a normalizer.
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

/**
 * GREEK / CYRILLIC LETTERS USED AS LATIN LOOK-ALIKES, folded ONLY when flanked by Latin letters.
 *
 * ⚠ A HOMOGLYPH IS THE SAME SHAPE AS A MOJIBAKE PHANTOM: a character from the wrong script masquerading as one
 * from the right one, invisible until something downstream depends on the distinction. It is the third variety
 * of it in this file, after the double-encoding repair and the squared-degree fold. Real text carries them —
 * `proteϊen` and `ruϊnes` are written with U+03CA GREEK SMALL LETTER IOTA WITH DIALYTIKA in place of Latin `ï`.
 *
 * ⚠ THE LATIN FLANK IS THE WHOLE GUARD, and it is what makes this fold safe with no opt-out list at all,
 * where `foldNativeDigits` needs one. A genuinely Greek or Cyrillic word has no Latin neighbours, so
 * `Ελλάδα` and `Владимир` cannot match however they are hosted; only a letter WEDGED INSIDE a Latin word can.
 *
 * ⚠ MOSTLY PRECAUTIONARY, NOT CORPUS-ATTESTED, and the distinction matters for how much weight the rows carry.
 * Across the fleet's corpora exactly ONE member of this table occurs between two Latin letters. Every other row
 * is here on the Unicode TR39 confusables basis — a phonemizer is handed arbitrary text, and homoglyphs arrive
 * from OCR and from keyboard-layout slips rather than from curated corpora. Admitting only the letters that
 * happen to occur would leave the same trap for the next corpus.
 *
 * ⚠ THE LOWERCASE MAPPING IS NOT THE LOWERCASE OF THE UPPERCASE ONE. Greek capital `Β` looks like Latin `B`, so it
 * folds to `B`. Greek small `β` does NOT look like `b` — it looks like German `ß`, which is why a mistyped or
 * OCR'd `Straβe` is far commoner than anyone intending a `b`. Folding `β`→`b` by symmetry with `Β`→`B` would be
 * wrong in exactly the case the row exists for.
 *
 * Without the row the letter is not merely mis-read, it FRAGMENTS the word: `β` is Greek script, so a Latin-script
 * tokenizer declines it, and a lone Greek letter is below the script router's two-letter threshold — so
 * `Straβe` comes out *stɹˈæ ˈiː* in English — the β gone and the word in two pieces.
 */
const LATIN_CONFUSABLE: Readonly<Record<string, string>> = {
    // Greek → Latin
    "ϊ": "ï", "Α": "A", "Β": "B", "Ε": "E", "Η": "H", "Ι": "I",
    "Κ": "K", "Μ": "M", "Ν": "N", "Ο": "O", "Ρ": "P", "Τ": "T",
    "Υ": "Y", "Χ": "X", "α": "a", "ο": "o", "ρ": "p", "υ": "u",
    // Greek LOWERCASE, whose Latin look-alikes differ from their capitals' (see the note above).
    "β": "ß", "ν": "v", "κ": "k", "χ": "x", "ι": "i",
    // Cyrillic → Latin
    "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H",
    "О": "O", "Р": "P", "С": "C", "Т": "T", "У": "Y", "Х": "X",
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y",
    "х": "x", "і": "i", "ё": "ë",
};
/**
 * Preceded by a Latin letter, and NOT followed by more of the homoglyph's own script.
 *
 * ⚠ REQUIRING LATIN ON BOTH SIDES MISSES THE WORD-FINAL CASE, which for the row this was written for is the
 * commonest one: German `ß` is word-final constantly — `Weiß`, `Gauß`, `Fluß`, `Maß` — so `Weiβ` and `Gauβ` were
 * left unrepaired and still lost the letter, while the medial `Straβe` was fixed. A trailing-context guard has to
 * admit the end of the word.
 *
 * The trailing lookahead is what keeps genuine Greek and Cyrillic safe, and it is strictly better than "must be
 * followed by Latin": a real Greek word is either not preceded by a Latin letter at all (`Το βιβλίο` — the β
 * follows a space) or continues in its own script (`theβιβλίο` — the β is followed by ι), and both are declined.
 */
const CONFUSABLE_RE = new RegExp(
    `(?<=\\p{Script=Latin})([${Object.keys(LATIN_CONFUSABLE).join("")}])`
    + `(?![\\p{Script=Greek}\\p{Script=Cyrillic}])`, "gu");

/** Fold a Greek/Cyrillic look-alike sitting INSIDE a Latin word to its Latin equivalent. */
export function foldLatinConfusables(s: string): string {
    CONFUSABLE_RE.lastIndex = 0;
    if (!CONFUSABLE_RE.test(s)) return s;
    CONFUSABLE_RE.lastIndex = 0;
    return s.replace(CONFUSABLE_RE, (c) => LATIN_CONFUSABLE[c]!);
}

/**
 * The MIRROR of the table above: a LATIN look-alike standing in for a Cyrillic letter. Only the rows where the
 * Latin glyph is genuinely confusable with a Cyrillic one, so this is not simply the inverse map — Latin `j`
 * for Cyrillic ⟨ј⟩ (U+0458) and `i` for ⟨і⟩ (U+0456) are the two that bite, because those Cyrillic letters
 * exist only in some of the alphabets (Macedonian, Serbian, Ukrainian, Belarusian) and a keyboard set for
 * Russian cannot type them.
 */
const CYRILLIC_CONFUSABLE: Readonly<Record<string, string>> = {
    a: "\u0430", c: "\u0441", e: "\u0435", i: "\u0456", j: "\u0458", o: "\u043e", p: "\u0440", s: "\u0455", x: "\u0445", y: "\u0443",
    A: "\u0410", B: "\u0412", C: "\u0421", E: "\u0415", H: "\u041d", I: "\u0406", J: "\u0408", K: "\u041a", M: "\u041c",
    O: "\u041e", P: "\u0420", S: "\u0405", T: "\u0422", X: "\u0425", Y: "\u0423",
    // ⚠ THE FOUR CHUVASH LETTERS, and they are the largest instance of this defect in the fleet by two orders
    // of magnitude. \u04d1 \u04d7 \u04ab \u04f3 (U+04D1/04D7/04AB/04F3) have Latin twins that render identically in most fonts
    // and sit on a Turkish or Romanian keyboard, and cv.wikipedia is written predominantly with the LATIN
    // ones: measured over the retained text of `tools/corpus/mined/chv.jsonc`, \u0103 \u0115 \u00e7 \u00fc occur **4,916
    // times against 918** for the real letters — a 5.4:1 ratio the wrong way, with 28 segments using both.
    // The cost was total: `\u00e7\u0115\u0440` (\u0441\u0435\u0440\u0440 "hundred/earth") read *s\u02c8\u025bp*, English "sep"; `\u0432\u0103\u0442\u0430\u043c` split into three
    // tokens; `\u043f\u0115\u0440\u0440\u0435\u043c\u0115\u0448` into five. **3,424 words** in that one artifact carry the defect.
    //
    // ⚠ FLEET-SAFE BY MEASUREMENT, not by assumption: across all 15 CYRILLIC_HOSTS artifacts, a
    // Cyrillic-majority word containing one of these four Latin letters occurs 3,356 times in chv and
    // **once** anywhere else (ba `\u0430\u0440\u0103\u043c`, itself the same typo). \u00e7 and \u00fc are common in Turkish, French
    // and German names, so this row was the one worth checking rather than assuming; the majority guard
    // above is what keeps `f\u00fcr`, `M\u00fcnchen` and `g\u00f6\u011fs\u00fcm` untouched, and it does.
};
const CHUVASH_CONFUSABLE: Readonly<Record<string, string>> = {
    "\u0103": "\u04d1", "\u0115": "\u04d7", "\u00e7": "\u04ab", "\u00fc": "\u04f3",
    "\u0102": "\u04d0", "\u0114": "\u04d6", "\u00c7": "\u04aa", "\u00dc": "\u04f2",
};
const CHV_KEYS = new RegExp(`[${Object.keys(CHUVASH_CONFUSABLE).join("")}]`, "gu");
const CYR_KEYS = new RegExp(`[${Object.keys(CYRILLIC_CONFUSABLE).join("")}]`, "gu");
const WORDISH = /[\p{L}\p{M}\p{Nd}]+/gu;

/**
 * Fold a Latin look-alike sitting INSIDE a Cyrillic word to its Cyrillic equivalent.
 *
 * ⚠ THE FAILURE THIS PREVENTS IS NOT A DROPPED CHARACTER. A Latin letter inside a Cyrillic word falls outside
 * the engine's token class, so the word SPLITS and the stray letter is handed to the foreign reader as an
 * ENGLISH LETTER NAME: Macedonian `Фаренхаjт` with a Latin j read *fˈarɛnxa d͡ʒˈeᶦ t*. Nothing is dropped and
 * no raw character survives, so no leak gate can see it.
 *
 * ⚠ THE DISCRIMINATOR IS WHICH SCRIPT DOMINATES THE WORD, not the immediate neighbours — and that is the one
 * thing a flank test cannot express. `foldLatinConfusables` uses a Latin flank because it only ever pulls
 * TOWARDS Latin; run both with flank guards and they fight: in `сeрiя` the Latin `e` gives the Cyrillic `р` a
 * Latin left-flank, so the Latin fold rewrites it to `p` and makes the word MORE Latin, after which no
 * trailing-lookahead guard can pull it back. Scoping to the word and requiring a Cyrillic majority settles the
 * direction once, before any character is rewritten.
 *
 * ⚠ AN EXACT TIE IS BROKEN BY THE HOST LANGUAGE, not guessed from the word. `рaсa` is 2 Cyrillic and 2 Latin,
 * and nothing in the word itself settles it — favouring Cyrillic would rewrite the two-letter Latin `оk`, and
 * first-letter script fails the same way. The host language is the evidence the WORD does not carry: inside a
 * Cyrillic-primary language (CYRILLIC_HOSTS) the tie folds to Cyrillic; anywhere else it declines and the
 * established Latin default stands.
 */
export function foldCyrillicConfusables(s: string, hostIsCyrillic = false): string {
    if (!/\p{Script=Cyrillic}/u.test(s)) return s;
    return s.replace(WORDISH, (w) => {
        let cyr = 0, lat = 0;
        for (const ch of w) {
            if (/\p{Script=Cyrillic}/u.test(ch)) cyr++;
            else if (/\p{Script=Latin}/u.test(ch)) lat++;
        }
        if (cyr === 0 || lat === 0) return w;
        // \u26a0 THE CHUVASH ROWS ARE APPLIED ON PRESENCE, NOT MAJORITY, and the asymmetry is the point. An
        // ASCII look-alike is a REAL LETTER OF THE LATIN ALPHABET, so a word carrying several of them may
        // genuinely be a Latin word and the majority test is what protects it. \u0103 \u0115 \u00e7 \u00fc standing beside a
        // Cyrillic letter cannot be: measured over all 15 CYRILLIC_HOSTS artifacts, the words the majority
        // rule REFUSES and presence would fold are **76 in chv** \u2014 `\u0103\u0448\u0103` (warm), `\u00e7\u0115\u0440`, `\u00e7\u0115\u043d\u0115` (new),
        // `\u0432\u0438\u00e7\u00e7\u0115` (three), all short words where two Latin twins outvote one Cyrillic letter \u2014 against
        // **one** anywhere else (tt `k\u00fcbr\u04d9`, itself already broken). Without this, `\u00e7\u0115\u0440` stayed *s\u02c8\u025bp*.
        w = w.replace(CHV_KEYS, (c) => CHUVASH_CONFUSABLE[c]!);
        cyr = 0; lat = 0;
        for (const ch of w) {
            if (/\p{Script=Cyrillic}/u.test(ch)) cyr++;
            else if (/\p{Script=Latin}/u.test(ch)) lat++;
        }
        if (lat === 0 || lat > cyr) return w; // Latin-majority word — leave it to the Latin fold
        if (lat === cyr && !hostIsCyrillic) return w; // an even split, and no host evidence to tip it
        CYR_KEYS.lastIndex = 0;
        return w.replace(CYR_KEYS, (c) => CYRILLIC_CONFUSABLE[c]!);
    });
}

/**
 * THE CYRILLIC DICTIONARY STRESS MARK — a combining acute (or grave) on a Cyrillic letter, which is NOT a
 * letter of any Cyrillic alphabet but a lexicographic annotation: `Абіса́ль`, `А́страхань`, `молоко́`. Wikipedia
 * writes it in the lead of an article to show where the word is stressed, so it arrives in running text.
 *
 * ⚠ THE FAILURE IS NOT A LOST ACCENT — IT IS A SPLIT WORD, and it is fleet-wide. Every Cyrillic engine in this
 * repo tokenizes on a BLOCK RANGE (`[Ѐ-ӿ]+`), and U+0301 is outside it, so the word breaks in two and BOTH
 * halves are then read and stressed as words: measured before this fold, `be Абіса́ль → abʲisa lʲ`,
 * `tt А́страхань → ˈɑ strɑˈxɑn`, `mn кабу́л → kʰap ɮ`, `kk аба́й → ɑbˈɑ jˈə`, `ru А́страхань → a strˈaxənʲ` —
 * 14 of the fleet's 14 Cyrillic-corpus languages, and `ru`, `uk`, `bg`, `mk` and `kk` were affected without
 * any of them appearing in the silent-deletion scan, because their artifacts simply happen not to carry one.
 * Nothing leaks and nothing is obviously dropped, which is why only the differential detector saw it.
 *
 * ⚠ THE MARK IS DROPPED, NOT HONOURED. Stress in these engines is computed by rule (Turkic oxytone, Chuvash
 * last-full-vowel, Tajik final) or by a lexicon (`ru`'s stress.tsv), and none of them takes a per-word stress
 * argument. Honouring the annotation would mean plumbing an override through fourteen engines to serve a
 * character that occurs a few dozen times per corpus; dropping it restores the CORRECT SEGMENTS, which is the
 * defect actually being fixed. `ru А́страхань` reads `ˈastrəxənʲ` after the fold — the lexicon's own stress,
 * which agrees with the annotation.
 *
 * ⚠ THE COMPOSITION CHECK IS LOAD-BEARING, and a blind strip would DELETE LETTERS. Macedonian ⟨ѓ⟩ and ⟨ќ⟩ ARE
 * ⟨г⟩/⟨к⟩ + U+0301 under NFD, and ⟨ѐ⟩ ⟨ѝ⟩ are ⟨е⟩/⟨и⟩ + U+0300 — real letters of the alphabet that a keyboard
 * or a copy-paste can deliver decomposed. So each base+mark pair is COMPOSED first: if NFC yields a single
 * character it is a letter and is kept (in its composed form, which is also what the token class wants);
 * only a pair that composes to nothing is an annotation and loses its mark.
 *
 * Restricted to a CYRILLIC base by design. The same mark is a tone letter in vi, a stress letter in es and a
 * tone mark in umbundu; this fold makes no claim about any of them.
 */
// ⚠ WRITTEN AS ESCAPES, NOT AS CHARACTERS. A combining mark typed literally inside `[...]` renders on top of
// the bracket and is invisible to review. U+0340/U+0341 are the deprecated "tone mark" spellings of the same
// two marks; they compose away under NFC, which the pair check below applies anyway.
const STRESS_MARKS = "\\u0300\\u0301\\u0340\\u0341";
const CYRILLIC_STRESS = new RegExp(`(\\p{Script=Cyrillic})([${STRESS_MARKS}]+)`, "gu");
const ANY_STRESS_MARK = new RegExp(`[${STRESS_MARKS}]`, "u");

export function foldCyrillicStressMarks(s: string): string {
    if (!ANY_STRESS_MARK.test(s)) return s;
    return s.replace(CYRILLIC_STRESS, (_m, base: string, marks: string) => {
        const composed = (base + marks).normalize("NFC");
        return [...composed].length === 1 ? composed : base;
    });
}

/**
 * REPAIR DOUBLE-ENCODED UTF-8 — text whose bytes were UTF-8 but got decoded as Latin-1 and re-encoded, so
 * `\u00b2` arrives as `\u00c2\u00b2` and `\u00f1` as `\u00c3\u00b1`. Mojibake is one of the commonest real-world corruptions in
 * scraped text, and a phonemizer is handed arbitrary text.
 *
 * WHY THIS IS SAFE, measured rather than assumed. The signature is `\u00c2` or `\u00c3` followed by a UTF-8
 * CONTINUATION byte (U+0080–U+00BF) — a sequence that occurs in no natural orthography, because those code
 * points are C1 controls and punctuation that never follow a capital A-circumflex or A-tilde. Counted across
 * all 67 FLEURS corpora: **31 occurrences, every one of them in id_id, and zero anywhere else.** All 31 are
 * genuine corruption:
 *   `19.500 km\u00c2\u00b2` (should be km\u00b2) · `Las Ca\u00c3\u00b1itas` (Ca\u00f1itas) · `David Kl\u00c3\u00b6cker` (Kl\u00f6cker)
 * The `km\u00c2\u00b2` case cost four readings outright: `\u00c2` IS a letter, so the tier's trailing guard rejected the
 * unit match and `km` reached the IPA raw.
 *
 * THE ARITHMETIC IS EXACT, not a lookup table. UTF-8 `C2 XX` encodes U+0080–U+00BF, and for a lead byte of
 * C2 the code point EQUALS the trailing byte, so the repair is simply to drop the `\u00c2`. For `C3 XX` the code
 * point is the trailing byte plus 0x40, which is why the second arm shifts.
 *
 * ⚠ LOSSY MOJIBAKE CANNOT BE REPAIRED AND IS NOT ATTEMPTED. mr_in carries `\u00e2\u0080\ufffd` twice — a curly quote whose
 * third byte was already replaced with U+FFFD upstream, so the information is gone. Two instances in one
 * corpus, and guessing which quote it was would be invention.
 */
/**
 * The bytes 0x80–0x9F have no Latin-1 characters, so a mis-decode of them goes through CP1252 instead — and
 * that is what makes the THREE-byte case look different from the two-byte one. `â€\u201c` is not
 * `\u00e2 + \u0080 + \u0093`; it is `\u00e2 + \u20ac + \u201c`, because CP1252 maps 0x80 to the euro sign and
 * 0x93 to a curly quote. An earlier pass measured the 3-byte signature as ZERO across all 67 corpora by
 * searching for the Latin-1 form, which does not occur — the CP1252 form occurs 16 times.
 */
const CP1252_BACK = new Map<number, number>([
    [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85], [0x2020, 0x86],
    [0x2021, 0x87], [0x02c6, 0x88], [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
    [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95],
    [0x2013, 0x96], [0x2014, 0x97], [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
    [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
]);

/** The byte a mis-decoded character came from: its CP1252 slot, or its own value in the Latin-1 range. */
function sourceByte(c: string): number | undefined {
    const o = c.codePointAt(0)!;
    const m = CP1252_BACK.get(o);
    if (m !== undefined) return m;
    return o >= 0x80 && o <= 0xff ? o : undefined;
}

export function repairDoubleEncoded(s: string): string {
    // The lead bytes the arms below can repair. This must stay in step with them: it was `[\u00c2\u00c3\u00e2]`
    // when the two-byte arms were C2/C3-only, and widening the arm to C5 without widening this fast path left
    // `\u00c4\u00b0zmir` returning EARLY and unrepaired \u2014 the fix silently did nothing.
    if (!/[\u00c2-\u00c5\u00e2\u00e3]/u.test(s)) return s;
    return s
        // THREE-BYTE first, or the two-byte arms below would eat its lead. `E2 XX YY` encodes U+0800–U+FFFF;
        // the lead nibble of 0xE2 is 2, so the code point is 0x2000 plus the two continuation payloads — which
        // is why every hit here is a dash, quote or ellipsis. Measured: 16 occurrences, all in id_id
        // (`â€“` → `–`, `â€”` → `—`), zero in the other 66 corpora.
        // LOSSY RESIDUE, where the third byte did not survive to be decoded — and the intended character is
        // still IDENTIFIABLE, which is the only reason this arm is allowed to guess. `â€` alone is `E2 80`, the
        // first two bytes of a General Punctuation character (U+2000–U+206F), so whatever is missing was
        // punctuation: a quote, a dash or a space. That bounds the damage — every candidate is either a clause
        // mark or silent in this engine, so choosing wrongly among them cannot produce a wrong WORD, whereas
        // leaving the sequence alone leaves a `€` that `\p{Sc}` reads as a PHANTOM CURRENCY. mr's
        // `currency DROP` was exactly that: a euro sign inside a broken quote, in a sentence with no money in it.
        //
        // ⚠ U+FFFD IS A FINGERPRINT, NOT NOISE. Of the E2 80 xx third bytes, only 0x81/0x8D/0x8F/0x90/0x9D are
        // unmapped in CP1252 and so become the replacement character — and among those, `E2 80 9D` is `”`, the
        // closing double quote, which is overwhelmingly the most frequent in running text. So `â€` + U+FFFD → `”`.
        // ⚠ THE PAIRING IS CORROBORATED ACROSS LANGUAGES, which is what settles the opening quote — FLEURS
        // translates ONE English set, so the same sentence exists elsewhere with its bytes intact:
        //   en  `For example, “learning” and “socialization” are suggested as important motivations …`
        //   hi  `उदाहरण के लिए, “लर्निंग” और “सोशलाइजेशन” को इंटरनेट …`
        //   mr  `उदाहरणार्थ, â€इलर्निंगâ€� आणि â€समाजीकरणâ€� ला इंटरनेट …`
        // Both siblings write U+201C/U+201D, so the residue before a letter is an OPENING quote, not a dash.
        // Measured: the sequence occurs in exactly two corpora, id_id (42) and mr_in (24), and nowhere else.
        .replace(/\u00e2[\s\S]{2}/gu, (m) => {
            const b2 = sourceByte(m[1]!), b3 = sourceByte(m[2]!);
            if (b2 === undefined || b3 === undefined) return m;
            if (b2 < 0x80 || b2 > 0xbf || b3 < 0x80 || b3 > 0xbf) return m;
            return String.fromCodePoint(((0xe2 & 0x0f) << 12) | ((b2 - 0x80) << 6) | (b3 - 0x80));
        })
        // ⚠ AFTER the three-byte pass, NOT BEFORE — the review caught this and my reasoning had been wrong.
        // I argued these arms were safe ahead of it because the well-formed third characters (U+201C for `–`,
        // U+201D for `—`) are punctuation and so could not match `[\p{L}\p{M}]`. True for those two, false in
        // general: `“` is `E2 80 9C` whose third byte 0x9C maps to `œ` — A LETTER — so the opening-quote arm
        // matched `â€` and stranded the `œ`, turning `â€œ` into `“œ`. Ordering after the full decode removes the
        // whole class of interception, which is why it is the right fix rather than widening the guard.
        .replace(/\u00e2\u20ac\ufffd/gu, "\u201d")
        .replace(/\u00e2\u20ac(?=[\p{L}\p{M}\s]|$)/gu, "\u201c")
        // TWO-BYTE, as the GENERAL formula rather than one arm per lead byte. `C2` and `C3` were special-cased
        // here for a while, and the case that showed why that was wrong is `\u00c4\u00b0zmir` \u2014 the mojibake of `\u0130`
        // (U+0130), whose UTF-8 is `C4 B0`. A lead byte of C4 was outside both arms, so the sequence survived
        // to the tier as `\u00c4` + `\u00b0` \u2014 AND `\u00b0` IS A DEGREE SIGN, so the audit reported a `degree` DROP on a
        // sentence about the population of a Turkish city. A phantom degree, exactly as `\u00e2\u20ac`'s stranded euro
        // was a phantom currency. The lesson repeats: half-repaired mojibake does not merely fail to read, it
        // MANUFACTURES a symbol for a later pass to reason about.
        //
        // `cp = ((lead & 0x1f) << 6) | (b2 & 0x3f)` is the UTF-8 definition, and it subsumes what the two arms
        // said: for C2 it returns b2 unchanged (hence "drop the \u00c2") and for C3 it returns b2 + 0x40 (hence the
        // shift). Extending to C4/C5 reaches Latin Extended-A \u2014 the Turkish, Polish and Baltic letters.
        //
        // BOUNDED BY MEASUREMENT, on the same standard as the arms above. `[C4C5]` + a continuation byte occurs
        // **twice across all 67 corpora, both `\u00c4\u00b0` in id_id**, and the next range up, `[C6-CF]`, occurs ZERO
        // times \u2014 so stopping at C5 costs nothing and every character this newly repairs is a real one.
        // ⚠ THE LOWERCASED LEADS `\u00e3` / `\u00e2` ARE HERE BECAUSE LOWERCASING DESTROYS THE SIGNATURE.
        // A corpus that has been case-folded — FLEURS is — turns the mojibake lead `\u00c3` into `\u00e3` and
        // `\u00c2` into `\u00e2`, and the repair above then does not match, so the whole token falls through
        // to the raw passthrough: id_id's `guaycur\u00e3\u00ba` (from `Guaycur\u00fa`) came out of the g2p as the literal
        // letters `g\u02c8uaycura\u00ba`. The uppercase form in the SAME corpus repairs correctly, which is what
        // made it visible. This is the casing wall a third time, after the initialism pass and the dotted
        // abbreviations.
        //
        // THE ARITHMETIC IS UNCHANGED because the mask does not care about case: `\u00e3 & 0x1f` and
        // `\u00c3 & 0x1f` are both 0x03, as are `\u00e2` and `\u00c2` at 0x02.
        //
        // ⚠ SAFE BY MEASUREMENT, AND `\u00e5` IS DELIBERATELY EXCLUDED. Across all 102 FLEURS corpora the
        // signature `[\u00e3\u00e2]` + a continuation character occurs 63 times — id_id 44, fil_ph 17, ceb_ph 2 — and
        // EVERY distinct pair decodes to an obviously correct character (`\u00e2\u00a3`→`£`, `\u00e2\u00a5`→`¥`, `\u00e2\u00b0`→`°`,
        // `\u00e2\u00b2`→`²`, `\u00e3\u00a7`→`ç`, `\u00e3\u00a9`→`é`, `\u00e3\u00ba`→`ú`, `\u00e3\u00bc`→`ü`). The same letters followed by
        // anything else — ordinary Portuguese and French — occur 57,516 times and are untouched, because a
        // real letter never follows them out of U+0080–U+00BF.
        //
        // `\u00e5` (from `\u00c5`) is NOT a lead here: it is an ordinary Nordic letter, and nb_no's `for n\u00e5».` is
        // "n\u00e5" (now) followed by a legitimate `»` closing quote, which sits in the continuation range. Adding
        // it would corrupt Norwegian to repair nothing.
        //
        // ⚠ KNOWN RESIDUE, PRE-EXISTING AND UNCHANGED BY THIS: a trailing byte that CP1252 maps OUT of
        // U+0080–U+00BF is still not matched, because this arm decodes the character directly instead of
        // going through `sourceByte()` the way the three-byte arm does. `\u00c3\u0153r\u00c3\u00bcmqi` (Ürümqi) half-repairs to
        // `\u00c3\u0153r\u00fcmqi` on main and does so identically here — byte 0x9C is `\u0153` in CP1252. Widening the trailing
        // class to reach it would pull in en-dashes and curly quotes, which occur constantly in running
        // text, to repair ONE token in 102 corpora. Not worth the blast radius; recorded instead.
        .replace(/([\u00c2-\u00c5\u00e2\u00e3])([\u0080-\u00bf])/gu, (_m, lead: string, c: string) =>
            String.fromCodePoint(((lead.codePointAt(0)! & 0x1f) << 6) | (c.codePointAt(0)! & 0x3f)));
}

/**
 * CARET EXPONENTS → real superscripts. `2^10`, `km^2`, `10^-31`, and the LaTeX-ish `10^{10}`.
 *
 * WHY THIS IS A FOLD AND NOT A LANGUAGE RULE: the caret is how a programmer types an exponent when the
 * keyboard has no superscripts, and it means the same thing in every language. Rendering it to `²`/`¹⁰`/`⁻³¹`
 * hands it to the exponent machinery that already exists, rather than asking 67 languages to learn a second
 * notation. Same argument as `foldSquaredDegrees` and `foldVulgarFractions`, which sit beside it.
 *
 * ⚠ UNHANDLED IT WAS WORSE THAN A DROP. `2^10` read as *tʰˈuː tʰˈɛn* — "two ten", two numbers with the
 * relationship gone; `10^-31` as *tʰˈɛn θˈɝd̬iː wˈʌn*, losing the sign as well; and `km^2` as *ˈʊkm tʰˈuː*,
 * with the unit abbreviation LEAKING raw because the caret broke its adjacency to the number.
 *
 * THE GUARD IS TIGHT because a caret is also an ordinary character. It must follow a letter or digit and be
 * followed only by digits (optionally signed, optionally braced), so a stray `^` in prose or a regex quoted in
 * running text cannot match. Measured across all 67 corpora and all 67 artifacts: `^` occurs ZERO times, so
 * this is robustness for input a caller may hand us, not a repair of anything sampled.
 */
const CARET_SUP: Readonly<Record<string, string>> = {
    "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
    "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻", "+": "⁺",
};
const CARET_RE = /(?<=[\p{L}\p{Nd}])\^\{?([+-]?\d+)\}?/gu;

export function foldCaretExponents(s: string): string {
    if (!s.includes("^")) return s;
    return s.replace(CARET_RE, (_m, exp: string) => [...exp].map((c) => CARET_SUP[c] ?? c).join(""));
}

/**
 * SQUARED DEGREE SIGNS → their two-character equivalents: ℃ → `°C`, ℉ → `°F`.
 *
 * WHY A FOLD RATHER THAN A RULE PER LANGUAGE. U+2103 and U+2109 are single code points that mean exactly what
 * `°C` and `°F` mean, and 52 of the 65 languages with a mined artifact ALREADY read `°C` correctly while
 * dropping `℃` — the whole unit, not just the sign: `20℃` came out as bare *twenty*. Folding is therefore the
 * only change that closes 52 languages at once, and it needs no new word in any of them. 13 already handled
 * both, because they had written the ℃ arm out by hand (bg ckb cmn da en hi is ja my nb ro sd sv); folding is
 * idempotent, so those stay as they are.
 *
 * ⚠ NOT `NFKC`, AND THIS IS THE WHOLE REASON THE LIST IS CURATED. Blanket compatibility normalisation looks
 * like the general answer and is measurably destructive here. Counting every compatibility character in the
 * corpora:
 *
 *   ²  → "2"     in 46 corpora   — would erase every exponent reading the tier composes
 *   …  → "..."   in 18 corpora   — one ellipsis becomes THREE clause breaks
 *   ¾  → "3⁄4"   in 35 corpora
 *   য় ড় ਸ਼ ਜ਼ ଡ଼ ज़ …           — nukta letters in five Indic scripts, recomposed differently
 *   ，（）：；                    — fullwidth punctuation the CJK layers claim deliberately
 *
 * ⚠ № IS DELIBERATELY EXCLUDED, though it is the same kind of character. NFKC gives `No`, and Bulgarian —
 * which writes it 21 times ("космонавт № 11") — says *номер*. Folding it would replace a dropped symbol with
 * an English word read by a Bulgarian g2p, which is the confidently-wrong outcome this tree ranks below
 * silence. It needs a per-language WORD, not a fold.
 *
 * The CJK squared units (㎞ ㎡ ㎥ ㎏ ㎜ ㎝ ㎢ ㏊) are omitted for a duller reason: zero occurrences in any
 * corpus, and each would need the language to declare that unit anyway.
 */
/**
 * VULGAR FRACTIONS → the ASCII `n/m` every language's fraction rule already matches.
 *
 * MEASURED FIRST, because the shape of the fix follows from it: 36 of the 67 artifacts contain a vulgar
 * fraction, **every one of them the same universal sentence** — the manuscript's `(measuring 29¾ inches × 24½
 * inches)` — and **27 of the 36 DROP it**, reading `29¾` as bare *twenty-nine*. Nine already handle it
 * (az ca el ga hr kn mk te uz). One sentence, twenty-seven languages, so this is a fold and not twenty-seven
 * vocabularies: each language then speaks it with the fraction machinery it already has.
 *
 * ⚠ NOT NFKC, for the reason `foldSquaredDegrees` gives at length — and here specifically because NFKC maps
 * `¾` to `3⁄4` with U+2044 FRACTION SLASH, which no language's fraction rule matches. The fold has to be ASCII
 * `/` to reach that machinery at all, which is why the compatibility mapping is not the answer even for the one
 * character where it looks closest.
 *
 * ⚠ A SPACE IS INSERTED AFTER A DIGIT, and without it the fold makes things worse rather than better. These are
 * MIXED numbers: `29¾` means twenty-nine and three quarters, so a bare substitution yields `293/4`, which
 * Gujarati's fraction rule already refuses by design — its comment records `293/4 and 241/2 are MIXED NUMBERS …
 * so `num < den` refuses them rather than saying "two hundred ninety-three divided by four"`. That refusal is
 * correct given `293/4`; the space is what makes the input honest. gu therefore goes from a documented refusal
 * to a reading, with no change to gu.
 *
 * ⚠ WHAT THIS DOES NOT SUPPLY is the "and" of *twenty-nine AND three quarters*, which is a per-language word in
 * a per-language position. The fold gets the fraction SPOKEN; joining it to the integer idiomatically is a
 * separate change, and th's own recording shows the reader saying the fraction as a unit
 * (`s e s a m s ʊ n s iː` = เศษสามส่วนสี่) rather than as an addition.
 */
const VULGAR: Readonly<Record<string, string>> = {
    "¼": "1/4", "½": "1/2", "¾": "3/4", "⅐": "1/7", "⅑": "1/9", "⅒": "1/10",
    "⅓": "1/3", "⅔": "2/3", "⅕": "1/5", "⅖": "2/5", "⅗": "3/5", "⅘": "4/5",
    "⅙": "1/6", "⅚": "5/6", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8",
};
const VULGAR_RE = new RegExp(`[${Object.keys(VULGAR).join("")}]`, "gu");

/** Vulgar fraction characters → ASCII `n/m`, spaced off a preceding digit so a mixed number stays two terms. */
export function foldVulgarFractions(s: string): string {
    if (!VULGAR_RE.test(s)) return s;
    VULGAR_RE.lastIndex = 0;
    return s.replace(VULGAR_RE, (c, off: number, full: string) =>
        (/\d/u.test(full[off - 1] ?? "") ? " " : "") + VULGAR[c]!);
}

export function foldSquaredDegrees(s: string): string {
    return s.replace(/℃/gu, "\u00b0C").replace(/℉/gu, "\u00b0F");
}

/**
 * FULLWIDTH LATIN LETTERS AND DIGITS → their ASCII twins (Ｇ→G, ７→7).
 *
 * The fullwidth forms are the same characters at CJK cell width, used inside Chinese, Japanese and Korean text for
 * Latin runs and numerals. Nothing downstream knows them: they are `Script=Latin` letters with NO decomposition, so
 * the mark-stripping fold cannot reach them and a g2p with no rule DROPS them. Attested in the corpora as `Ｇ` and
 * `Ｗ` inside CJK sentences.
 *
 * ⚠ LETTERS AND DIGITS ONLY, not the whole fullwidth block. U+FF01–FF5E also holds fullwidth PUNCTUATION, and the
 * CJK engines already read their own `，、。？！` and the fullwidth ASCII marks deliberately — folding those would
 * reach into decisions those engines have already made. This is the narrow half of NFKC that is unambiguously
 * safe, chosen for the same reason `foldSquaredDegrees` stops at two characters instead of applying NFKC wholesale.
 */
const FULLWIDTH = /[\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A]/gu;
export function foldFullwidthLatin(s: string): string {
    FULLWIDTH.lastIndex = 0;
    if (!FULLWIDTH.test(s)) return s;
    FULLWIDTH.lastIndex = 0;
    return s.replace(FULLWIDTH, (c) => String.fromCodePoint(c.codePointAt(0)! - 0xFEE0));
}

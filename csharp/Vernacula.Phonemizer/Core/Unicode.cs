/**
 * Notation-parsing PRIMITIVES for the native abugida path — pure Unicode/IPA facts about HOW to read the
 * string (which code points are vowels, modifiers, tie bars, digits; which block is a script), plus the
 * text repairs the registry composes: mojibake, homoglyphs, native digits, caret and vulgar notations.
 * Ported from src/core/unicode.ts — see that file for the corpus evidence.
 */
using System.Globalization;
using System.Text;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Core;

public static class Unicode
{
    /** Combining diacritics block U+0300–U+036F (̀-ͯ): attach to the preceding base (nasal ◌̃, dental ◌̪). */
    public const string COMBINING_DIACRITICS = "̀-ͯ";

    /** Tie bar U+0361 (͡): joins the two halves of an affricate (t͡ʃ, d͡ʑ) into one token. */
    public const string TIE_BAR = "͡";

    /** IPA spacing modifiers that attach to the preceding unit: length ː ˑ, palatalization ʲ, aspiration ʰ,
     *  breathy ʱ, ejective ʼ. (Combined with {@link COMBINING_DIACRITICS} to form the tokenizer's MOD set.) */
    public const string ATTACHING_MODIFIERS = "ːˑʲʰʱʼ";

    /**
     * IPA vowel letters — the universal alphabet the stress tokenizer treats as syllable nuclei.
     * ⚠ RE-EXPORTED, NOT DEFINED HERE: Core/Ipa.cs owns the phone classes. Kept here so the existing regex
     * users need not care where it moved.
     */
    public const string IPA_VOWELS = Ipa.IPA_VOWELS;

    /** Primary / secondary stress marks (IPA). */
    public const string STRESS_PRIMARY = "ˈ";
    public const string STRESS_SECONDARY = "ˌ";

    /** Devanagari block U+0900–U+097F (ऀ-ॿ) — script detection. */
    public const string DEVANAGARI_BLOCK = "ऀ-ॿ";

    /** Word-forming Devanagari: letters + signs + vocalic extensions, EXCLUDING the digits (U+0966–096F)
     *  and the danda/punctuation — i.e. ऀ-ॣ (U+0900–0963) + ॲ-ॿ (U+0972–097F). Used to split text into
     *  word runs so a digit run breaks out as its own (number) token. */
    public const string DEVANAGARI_WORD = "ऀ-ॣॲ-ॿ";

    /**
     * Devanagari digits ०-९ → ASCII. ⚠ INSERTION-ORDERED: consumers build character classes from the keys, so
     * the order is the class's order — a Dictionary keeps it as long as nothing is removed, and nothing is.
     */
    public static readonly IReadOnlyDictionary<string, string> DEVANAGARI_DIGITS = new Dictionary<string, string>
    {
        ["०"] = "0", ["१"] = "1", ["२"] = "2", ["३"] = "3", ["४"] = "4",
        ["५"] = "5", ["६"] = "6", ["७"] = "7", ["८"] = "8", ["९"] = "9",
    };

    /** Word-forming Bengali (U+0980 block): letters + signs + matras + vocalic, EXCLUDING the digits
     *  (U+09E6–09EF) and punctuation — i.e. ঀ-ৣ (U+0980–09E3) + ৰ-৾ (U+09F0–09FE, ra/wa variants + signs).
     *  Bengali uses the shared danda । (U+0964) for clause punctuation, handled separately. */
    public const string BENGALI_WORD = "ঀ-ৣৰ-৾";

    // Gujarati block (U+0A80–U+0AFF) minus the digit range — a word run.
    public const string GUJARATI_WORD = "઀-૥૰-૿";

    /** Gujarati digits ૦-૯ → ASCII, for number parsing. */
    public static readonly IReadOnlyDictionary<string, string> GUJARATI_DIGITS = new Dictionary<string, string>
    {
        ["૦"] = "0", ["૧"] = "1", ["૨"] = "2", ["૩"] = "3", ["૪"] = "4",
        ["૫"] = "5", ["૬"] = "6", ["૭"] = "7", ["૮"] = "8", ["૯"] = "9",
    };

    /** Bengali digits ০-৯ → ASCII, for number parsing. */
    public static readonly IReadOnlyDictionary<string, string> BENGALI_DIGITS = new Dictionary<string, string>
    {
        ["০"] = "0", ["১"] = "1", ["২"] = "2", ["৩"] = "3", ["৪"] = "4",
        ["৫"] = "5", ["৬"] = "6", ["৭"] = "7", ["৮"] = "8", ["৯"] = "9",
    };

    /** Latin letters that have no combining-mark decomposition, so NFD alone cannot fold them. */
    private static readonly IReadOnlyDictionary<string, string> LATIN_ATOMIC = new Dictionary<string, string>
    {
        ["ø"] = "o", ["æ"] = "ae", ["œ"] = "oe", ["ß"] = "ss", ["ł"] = "l", ["đ"] = "d",
        ["ð"] = "d", ["þ"] = "th", ["ħ"] = "h", ["ı"] = "i", ["ŋ"] = "ng",
    };

    private static readonly JsRe MarksRun = JsRegex.Compile(@"\p{M}+", "gu");
    private static readonly JsRe LatinAtomicRe = JsRegex.Compile("[øæœßłđðþħıŋ]", "gu");

    /**
     * Fold Latin diacritics to the ASCII base letters an English-style lexicon and G2P are trained on:
     * café → cafe, jalapeño → jalapeno. Lossy by design where the accent is the only distinction (résumé and
     * resume fold together) — a documented conflation, better than mangling the word.
     */
    public static string FoldLatinDiacritics(string s)
    {
        // ⚠ OFF THE SEAM, and the TypeScript learned this the hard way: `foldLatinDiacritics` is called PER
        // WORD from `resolveWord`, not on the pipeline string, so routing it through `Rewrite` poisons the
        // mapping on every utterance. It also strips marks with a plain `Replace` first, which the seam
        // would not see anyway.
        var stripped = MarksRun.Replace(s.Normalize(NormalizationForm.FormD), "");
        return JsRegex.Replace(stripped, LatinAtomicRe, m =>
            LATIN_ATOMIC.TryGetValue(m.Value, out var v) ? v : m.Value);
    }

    /**
     * Decimal-digit block bases for every script this project supports. Unicode guarantees a decimal digit
     * block is ten contiguous code points in ascending value, so the fold below is arithmetic rather than a
     * per-script table.
     */
    private static readonly int[] NATIVE_DIGIT_BASES =
    {
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
    };

    /**
     * Fold any script's own decimal digits to ASCII, so the number path can read them: an engine whose number
     * token is the ASCII-only JS `\d` sees a native numeral as no token at all, and the number VANISHES.
     *
     * ⚠ APPLIED FLEET-WIDE AT THE REGISTRY, with an opt-out list, and that single fact is what makes the
     * fleet's ASCII digit classes correct rather than blind. Idempotent, so the per-language folds that
     * predate the registry one stay.
     *
     * ⚠ AND IT RUNS LAST AMONG THE REPAIRS, a live ordering constraint: every fold composed around it in the
     * registry sees the string BEFORE this one has run, so an ASCII-only digit guard inside any of them is
     * blind to a native digit.
     */
    // C# PORT NOTE: the TS is `s.replace(/\p{Nd}/gu, …)`. A .NET pattern cannot see an ASTRAL digit
    // (Adlam U+1E950–1E959, in the table above) — the one place the JsRegex translator's \p{Nd}
    // pass-through would silently diverge — so this fold walks code points and reads the SAME Unicode
    // property (Rune.GetUnicodeCategory == Nd) the JS regex does. Outputs are identical.
    public static string FoldNativeDigits(string s)
    {
        // ⚠ #1150: THIS REBUILDS, IT DOES NOT REPLACE, and that is why it could not be put on the `Rewrite`
        // seam like its TypeScript twin. It was the largest remaining C#-only gap: `२.`→`2.` and `۱۱:۲۰`→
        // `11:20` desynced the mapping before any `Rewrite` ran, and mai/awa/mag/syl/fa each lost most of
        // their tokens while the TypeScript had them at 100%. The piece list is built only while tracing.
        var rec = Tracing();
        var pieces = rec ? new List<Piece>() : null;
        StringBuilder? sb = null;
        var consumed = 0;
        foreach (var rune in s.EnumerateRunes())
        {
            var width = rune.Utf16SequenceLength;
            var emitted = rune.ToString();
            if (Rune.GetUnicodeCategory(rune) == UnicodeCategory.DecimalDigitNumber && rune.Value >= 0x80)
            {
                var cp = rune.Value;
                var replaced = false;
                foreach (var baseCp in NATIVE_DIGIT_BASES)
                {
                    if (cp >= baseCp && cp <= baseCp + 9)
                    {
                        sb ??= new StringBuilder(s[..consumed]);
                        emitted = ((char)('0' + (cp - baseCp))).ToString();
                        sb.Append(emitted);
                        replaced = true;
                        break;
                    }
                }
                if (!replaced) sb?.Append(emitted); // a block we do not carry: leave it rather than guess
            }
            else sb?.Append(emitted);
            pieces?.Add(new Piece(emitted, consumed, consumed + width));
            consumed += width;
        }
        if (sb is null) return s;                       // a no-op: the mapping already describes `s`
        return rec ? Rebuilt(s, pieces!) : sb.ToString();
    }

    /**
     * GREEK / CYRILLIC LETTERS USED AS LATIN LOOK-ALIKES, folded ONLY when flanked by Latin letters.
     *
     * ⚠ THE LATIN FLANK IS THE WHOLE GUARD, and it is what makes this fold safe with no opt-out list, where
     * `FoldNativeDigits` needs one. A genuinely Greek or Cyrillic word has no Latin neighbours.
     *
     * ⚠ THE LOWERCASE MAPPING IS NOT THE LOWERCASE OF THE UPPERCASE ONE. Greek `Β` looks like Latin `B`; Greek
     * `β` does not look like `b` — it looks like German `ß`. Folding by symmetry would be wrong in exactly the
     * case the row exists for.
     */
    private static readonly IReadOnlyDictionary<string, string> LATIN_CONFUSABLE = new Dictionary<string, string>
    {
        // Greek → Latin
        ["ϊ"] = "ï", ["Α"] = "A", ["Β"] = "B", ["Ε"] = "E", ["Η"] = "H", ["Ι"] = "I",
        ["Κ"] = "K", ["Μ"] = "M", ["Ν"] = "N", ["Ο"] = "O", ["Ρ"] = "P", ["Τ"] = "T",
        ["Υ"] = "Y", ["Χ"] = "X", ["α"] = "a", ["ο"] = "o", ["ρ"] = "p", ["υ"] = "u",
        // Greek LOWERCASE, whose Latin look-alikes differ from their capitals' (see the note above).
        ["β"] = "ß", ["ν"] = "v", ["κ"] = "k", ["χ"] = "x", ["ι"] = "i",
        // Cyrillic → Latin
        ["А"] = "A", ["В"] = "B", ["Е"] = "E", ["К"] = "K", ["М"] = "M", ["Н"] = "H",
        ["О"] = "O", ["Р"] = "P", ["С"] = "C", ["Т"] = "T", ["У"] = "Y", ["Х"] = "X",
        ["а"] = "a", ["е"] = "e", ["о"] = "o", ["р"] = "p", ["с"] = "c", ["у"] = "y",
        ["х"] = "x", ["і"] = "i", ["ё"] = "ë",
    };

    /**
     * Preceded by a Latin letter, and NOT followed by more of the homoglyph's own script.
     *
     * ⚠ REQUIRING LATIN ON BOTH SIDES MISSES THE WORD-FINAL CASE, which for German `ß` is the commonest one.
     * The trailing lookahead is what keeps genuine Greek and Cyrillic safe: such a word either is not preceded
     * by a Latin letter at all, or continues in its own script.
     */
    private static readonly JsRe CONFUSABLE_RE = JsRegex.Compile(
        @"(?<=\p{Script=Latin})([" + string.Concat(LATIN_CONFUSABLE.Keys) + "])"
        + @"(?![\p{Script=Greek}\p{Script=Cyrillic}])", "gu");

    /** Fold a Greek/Cyrillic look-alike sitting INSIDE a Latin word to its Latin equivalent. */
    public static string FoldLatinConfusables(string s)
    {
        if (!CONFUSABLE_RE.IsMatch(s)) return s;
        return Rewrite(s, CONFUSABLE_RE, m => LATIN_CONFUSABLE[m.Groups[1].Value]);
    }

    /**
     * The MIRROR of the table above: a LATIN look-alike standing in for a Cyrillic letter. Only the rows where
     * the Latin glyph is genuinely confusable, so this is not simply the inverse map.
     */
    private static readonly IReadOnlyDictionary<string, string> CYRILLIC_CONFUSABLE = new Dictionary<string, string>
    {
        ["a"] = "а", ["c"] = "с", ["e"] = "е", ["i"] = "і", ["j"] = "ј",
        ["o"] = "о", ["p"] = "р", ["s"] = "ѕ", ["x"] = "х", ["y"] = "у",
        ["A"] = "А", ["B"] = "В", ["C"] = "С", ["E"] = "Е", ["H"] = "Н",
        ["I"] = "І", ["J"] = "Ј", ["K"] = "К", ["M"] = "М",
        ["O"] = "О", ["P"] = "Р", ["S"] = "Ѕ", ["T"] = "Т", ["X"] = "Х", ["Y"] = "У",
        // ⚠ THE FOUR CHUVASH LETTERS. ӑ ӗ ҫ ӳ have Latin twins that render identically in most fonts and sit on
        // a Turkish or Romanian keyboard, and Chuvash text is written predominantly with the LATIN ones. ç and ü
        // are common in Turkish, French and German names, so the majority guard below is what keeps `für`,
        // `München` and `göğsüm` untouched.
    };

    private static readonly IReadOnlyDictionary<string, string> CHUVASH_CONFUSABLE = new Dictionary<string, string>
    {
        ["ă"] = "ӑ", ["ĕ"] = "ӗ", ["ç"] = "ҫ", ["ü"] = "ӳ",
        ["Ă"] = "Ӑ", ["Ĕ"] = "Ӗ", ["Ç"] = "Ҫ", ["Ü"] = "Ӳ",
    };

    private static readonly JsRe CHV_KEYS =
        JsRegex.Compile("[" + string.Concat(CHUVASH_CONFUSABLE.Keys) + "]", "gu");

    private static readonly JsRe CYR_KEYS =
        JsRegex.Compile("[" + string.Concat(CYRILLIC_CONFUSABLE.Keys) + "]", "gu");

    private static readonly JsRe WORDISH = JsRegex.Compile(@"[\p{L}\p{M}\p{Nd}]+", "gu");

    private static readonly JsRe CyrillicOne = JsRegex.Compile(@"\p{Script=Cyrillic}", "u");
    private static readonly JsRe LatinOne = JsRegex.Compile(@"\p{Script=Latin}", "u");

    /**
     * Fold a Latin look-alike sitting INSIDE a Cyrillic word to its Cyrillic equivalent. ⚠ THE FAILURE THIS
     * PREVENTS IS NOT A DROPPED CHARACTER: the word SPLITS and the stray letter goes to the foreign reader as
     * an ENGLISH LETTER NAME, so no leak gate can see it.
     *
     * ⚠ THE DISCRIMINATOR IS WHICH SCRIPT DOMINATES THE WORD, not the immediate neighbours. Run both folds
     * with flank guards and they fight — a Latin letter gives its Cyrillic neighbour a Latin flank, the Latin
     * fold makes the word MORE Latin, and no lookahead can pull it back. Scoping to the word and requiring a
     * Cyrillic majority settles the direction once, before any character is rewritten.
     *
     * ⚠ AN EXACT TIE IS BROKEN BY THE HOST LANGUAGE, not guessed from the word: inside a Cyrillic-primary
     * language the tie folds to Cyrillic, anywhere else it declines and the Latin default stands.
     */
    public static string FoldCyrillicConfusables(string s, bool hostIsCyrillic = false)
    {
        if (!CyrillicOne.IsMatch(s)) return s;
        return Rewrite(s, WORDISH, m =>
        {
            var w = m.Value;
            var cyr = 0;
            var lat = 0;
            foreach (var ch in Js.CodePoints(w))
            {
                if (CyrillicOne.IsMatch(ch)) cyr++;
                else if (LatinOne.IsMatch(ch)) lat++;
            }
            if (cyr == 0 || lat == 0) return w;
            // ⚠ THE CHUVASH ROWS ARE APPLIED ON PRESENCE, NOT MAJORITY, and the asymmetry is the point. An ASCII
            // look-alike is a REAL LETTER OF THE LATIN ALPHABET, so a word carrying several may genuinely be a Latin
            // word and the majority test is what protects it. ă ĕ ç ü standing beside a Cyrillic letter cannot be —
            // and they are short words, where two Latin twins outvote one Cyrillic letter.
            // ⚠ `w` is a MATCHED WORD, not the pipeline string — the outer Rewrite already reports this pass.
            w = JsRegex.Replace(w, CHV_KEYS, c => CHUVASH_CONFUSABLE[c.Value]);
            cyr = 0;
            lat = 0;
            foreach (var ch in Js.CodePoints(w))
            {
                if (CyrillicOne.IsMatch(ch)) cyr++;
                else if (LatinOne.IsMatch(ch)) lat++;
            }
            if (lat == 0 || lat > cyr) return w; // Latin-majority word — leave it to the Latin fold
            if (lat == cyr && !hostIsCyrillic) return w; // an even split, and no host evidence to tip it
            return JsRegex.Replace(w, CYR_KEYS, c => CYRILLIC_CONFUSABLE[c.Value]); // per-word, as above
        });
    }

    /**
     * THE CYRILLIC DICTIONARY STRESS MARK — a combining acute (or grave) on a Cyrillic letter, which is not a
     * letter of any Cyrillic alphabet but a lexicographic annotation. ⚠ THE FAILURE IS NOT A LOST ACCENT BUT A
     * SPLIT WORD: every Cyrillic engine here tokenizes on a BLOCK RANGE, U+0301 is outside it, and both halves
     * are then read and stressed as words.
     *
     * ⚠ THE MARK IS DROPPED, NOT HONOURED. Stress in these engines is computed by rule or by a lexicon, and
     * none takes a per-word stress argument; dropping restores the correct SEGMENTS, which is the defect.
     *
     * ⚠ THE COMPOSITION CHECK IS LOAD-BEARING, and a blind strip would DELETE LETTERS: Macedonian ⟨ѓ⟩ ⟨ќ⟩ ⟨ѐ⟩
     * ⟨ѝ⟩ ARE base + U+0301/U+0300 under NFD. So each pair is COMPOSED first — if NFC yields a single character
     * it is a letter and is kept; only a pair that composes to nothing is an annotation and loses its mark.
     *
     * Restricted to a CYRILLIC base by design; the same mark is a tone or stress letter elsewhere.
     */
    // ⚠ WRITTEN AS ESCAPES, NOT AS CHARACTERS. A combining mark typed literally inside `[...]` renders on
    // top of the bracket and is invisible to review. U+0340/U+0341 are the deprecated spellings of the same
    // two marks; they compose away under NFC, which the pair check below applies anyway.
    private const string STRESS_MARKS = "\\u0300\\u0301\\u0340\\u0341";

    private static readonly JsRe CYRILLIC_STRESS =
        JsRegex.Compile("(\\p{Script=Cyrillic})([" + STRESS_MARKS + "]+)", "gu");

    private static readonly JsRe ANY_STRESS_MARK =
        JsRegex.Compile("[" + STRESS_MARKS + "]", "u");

    public static string FoldCyrillicStressMarks(string s)
    {
        if (!ANY_STRESS_MARK.IsMatch(s)) return s;
        return Rewrite(s, CYRILLIC_STRESS, m =>
        {
            var baseCh = m.Groups[1].Value;
            var marks = m.Groups[2].Value;
            var composed = (baseCh + marks).Normalize(NormalizationForm.FormC);
            return Js.CodePoints(composed).Count == 1 ? composed : baseCh;
        });
    }

    /**
     * REPAIR DOUBLE-ENCODED UTF-8 — text whose bytes were UTF-8 but got decoded as Latin-1 and re-encoded, so
     * `²` arrives as `Â²` and `ñ` as `Ã±`. The signature is a lead byte followed by a UTF-8 CONTINUATION byte
     * (U+0080–U+00BF), a sequence that occurs in no natural orthography.
     *
     * THE ARITHMETIC IS EXACT, not a lookup table: `cp = ((lead & 0x1f) << 6) | (b2 & 0x3f)` is the UTF-8
     * definition. ⚠ HALF-REPAIRED MOJIBAKE DOES NOT MERELY FAIL TO READ, IT MANUFACTURES A SYMBOL for a later
     * pass to reason about — a stranded `°` becomes a phantom degree, a stranded `€` a phantom currency.
     *
     * ⚠ LOSSY MOJIBAKE CANNOT BE REPAIRED AND IS NOT ATTEMPTED where the intended character is unrecoverable.
     */
    /**
     * The bytes 0x80–0x9F have no Latin-1 characters, so a mis-decode of them goes through CP1252 instead —
     * which is why the THREE-byte case looks different from the two-byte one. `â€“` is not
     * `â + U+0080 + U+0093` but `â + € + U+201C`, because CP1252 maps 0x80 to the euro sign.
     */
    private static readonly IReadOnlyDictionary<int, int> CP1252_BACK = new Dictionary<int, int>
    {
        [0x20ac] = 0x80, [0x201a] = 0x82, [0x0192] = 0x83, [0x201e] = 0x84, [0x2026] = 0x85, [0x2020] = 0x86,
        [0x2021] = 0x87, [0x02c6] = 0x88, [0x2030] = 0x89, [0x0160] = 0x8a, [0x2039] = 0x8b, [0x0152] = 0x8c,
        [0x017d] = 0x8e, [0x2018] = 0x91, [0x2019] = 0x92, [0x201c] = 0x93, [0x201d] = 0x94, [0x2022] = 0x95,
        [0x2013] = 0x96, [0x2014] = 0x97, [0x02dc] = 0x98, [0x2122] = 0x99, [0x0161] = 0x9a, [0x203a] = 0x9b,
        [0x0153] = 0x9c, [0x017e] = 0x9e, [0x0178] = 0x9f,
    };

    /** The byte a mis-decoded character came from: its CP1252 slot, or its own value in the Latin-1 range. */
    private static int? SourceByte(char c)
    {
        var o = (int)c;
        if (CP1252_BACK.TryGetValue(o, out var m)) return m;
        return o >= 0x80 && o <= 0xff ? o : null;
    }

    // The exact escape spellings the TS source uses (unicode.ts) - literal C1 characters would be
    // invisible to review.
    private static readonly JsRe MojibakeLead = JsRegex.Compile("[\\u00c2-\\u00c5\\u00e2\\u00e3]", "u");
    private static readonly JsRe ThreeByte = JsRegex.Compile("\\u00e2[\\s\\S]{2}", "gu");
    private static readonly JsRe LossyCloseQuote = JsRegex.Compile("\\u00e2\\u20ac\\ufffd", "gu");
    private static readonly JsRe LossyOpenQuote = JsRegex.Compile("\\u00e2\\u20ac(?=[\\p{L}\\p{M}\\s]|$)", "gu");
    private static readonly JsRe TwoByte = JsRegex.Compile("([\\u00c2-\\u00c5\\u00e2\\u00e3])([\\u0080-\\u00bf])", "gu");

    public static string RepairDoubleEncoded(string s)
    {
        // ⚠ THE FAST PATH MUST STAY IN STEP WITH THE ARMS BELOW. It was narrower than they were once, and
        // widening an arm without widening this made the fix silently do nothing.
        if (!MojibakeLead.IsMatch(s)) return s;
        // ⚠ THREE-BYTE FIRST, or the two-byte arms below would eat its lead. `E2 XX YY` encodes U+0800–U+FFFF,
        // and with a lead of 0xE2 the code point is 0x2000 plus the two payloads — so every hit is a dash, quote
        // or ellipsis.
        //
        // LOSSY RESIDUE, where the third byte did not survive to be decoded, and the intended character is still
        // IDENTIFIABLE — which is the only reason this arm is allowed to guess. `â€` alone is `E2 80`, the first
        // two bytes of a General Punctuation character, so whatever is missing was punctuation: every candidate
        // is a clause mark or silent here, whereas leaving it alone leaves a `€` that `\p{Sc}` reads as a
        // PHANTOM CURRENCY. ⚠ U+FFFD IS A FINGERPRINT, NOT NOISE: of the E2 80 xx third bytes only a handful are
        // unmapped in CP1252, and among those the closing double quote is overwhelmingly the commonest.
        s = Rewrite(s, ThreeByte, m =>
        {
            var b2 = SourceByte(m.Value[1]);
            var b3 = SourceByte(m.Value[2]);
            if (b2 is null || b3 is null) return m.Value;
            if (b2 < 0x80 || b2 > 0xbf || b3 < 0x80 || b3 > 0xbf) return m.Value;
            return Js.FromCodePoint(((0xe2 & 0x0f) << 12) | ((b2.Value - 0x80) << 6) | (b3.Value - 0x80));
        });
        // ⚠ AFTER the three-byte pass, NOT BEFORE. These arms look safe ahead of it because the well-formed
        // third characters are punctuation, but that is only true of some: `“` is `E2 80 9C`, whose third byte
        // 0x9C maps to `œ` — A LETTER — so the opening-quote arm matched `â€` and stranded the `œ`. Ordering
        // after the full decode removes the whole class of interception.
        s = Rewrite(s, LossyCloseQuote, "”");
        s = Rewrite(s, LossyOpenQuote, "“");
        // TWO-BYTE, as the GENERAL formula rather than one arm per lead byte: for C2 it returns b2 unchanged and
        // for C3 it returns b2 + 0x40, and extending to C4/C5 reaches Latin Extended-A. Bounded there by
        // measurement — the next range up never occurs.
        //
        // ⚠ THE LOWERCASED LEADS `ã` / `â` ARE HERE BECAUSE LOWERCASING DESTROYS THE SIGNATURE. A corpus that has
        // been case-folded turns the lead `Ã` into `ã`, the repair no longer matches, and the whole token falls
        // through to the raw passthrough. The arithmetic is unchanged, because the mask does not care about case.
        //
        // ⚠ `å` IS DELIBERATELY EXCLUDED: it is an ordinary Nordic letter, and Norwegian `nå»` is that word
        // followed by a legitimate closing quote, which sits in the continuation range.
        //
        // ⚠ KNOWN RESIDUE: a trailing byte that CP1252 maps OUT of U+0080–U+00BF is not matched, because this arm
        // decodes the character directly instead of going through `SourceByte()` the way the three-byte arm does.
        // Widening the trailing class to reach it would pull in en-dashes and curly quotes.
        return Rewrite(s, TwoByte, m =>
            Js.FromCodePoint(((m.Groups[1].Value[0] & 0x1f) << 6) | (m.Groups[2].Value[0] & 0x3f)));
    }

    /**
     * CARET EXPONENTS → real superscripts. `2^10`, `km^2`, `10^-31`, and the LaTeX-ish `10^{10}`: the caret is
     * how a programmer types an exponent, and it means the same thing in every language, so rendering it hands
     * it to the exponent machinery that already exists. THE GUARD IS TIGHT because a caret is also an ordinary
     * character — it must follow a letter or digit and be followed only by digits, optionally signed or braced.
     */
    private static readonly IReadOnlyDictionary<string, string> CARET_SUP = new Dictionary<string, string>
    {
        ["0"] = "⁰", ["1"] = "¹", ["2"] = "²", ["3"] = "³", ["4"] = "⁴",
        ["5"] = "⁵", ["6"] = "⁶", ["7"] = "⁷", ["8"] = "⁸", ["9"] = "⁹", ["-"] = "⁻", ["+"] = "⁺",
    };

    private static readonly JsRe CARET_RE = JsRegex.Compile(@"(?<=[\p{L}\p{Nd}])\^\{?([+-]?\d+)\}?", "gu");

    public static string FoldCaretExponents(string s)
    {
        if (!s.Contains('^')) return s;
        return Rewrite(s, CARET_RE, m =>
            string.Concat(Js.CodePoints(m.Groups[1].Value)
                .Select(c => CARET_SUP.TryGetValue(c, out var v) ? v : c)));
    }

    /**
     * SQUARED DEGREE SIGNS → their two-character equivalents: ℃ → `°C`, ℉ → `°F`. Idempotent, so the engines
     * that already wrote the ℃ arm by hand stay as they are.
     *
     * ⚠ NOT `NFKC`, AND THAT IS WHY THE LIST IS CURATED. Blanket compatibility normalisation looks like the
     * general answer and is measurably destructive: `²`→`2` erases every exponent reading the tier composes,
     * `…`→`...` turns one ellipsis into three clause breaks, the Indic nukta letters recompose differently, and
     * the fullwidth punctuation the CJK layers claim deliberately is folded out from under them.
     * ⚠ № IS DELIBERATELY EXCLUDED though it is the same kind of character: NFKC gives `No`, an English word
     * read by a non-English g2p. It needs a per-language WORD, not a fold.
     */
    /**
     * VULGAR FRACTIONS → the ASCII `n/m` every language's fraction rule already matches, so each language
     * speaks it with the fraction machinery it already has.
     *
     * ⚠ NOT NFKC, for the reason `FoldSquaredDegrees` gives, and here specifically because NFKC maps `¾` to
     * `3⁄4` with U+2044 FRACTION SLASH, which no language's fraction rule matches.
     *
     * ⚠ A SPACE IS INSERTED AFTER A DIGIT, and without it the fold makes things worse: these are MIXED numbers,
     * so a bare substitution yields `293/4`, which a fraction rule is right to refuse. The space is what makes
     * the input honest. ⚠ WHAT THIS DOES NOT SUPPLY is the "and" of *twenty-nine AND three quarters*, which is
     * a per-language word in a per-language position.
     */
    private static readonly IReadOnlyDictionary<string, string> VULGAR = new Dictionary<string, string>
    {
        ["¼"] = "1/4", ["½"] = "1/2", ["¾"] = "3/4", ["⅐"] = "1/7", ["⅑"] = "1/9", ["⅒"] = "1/10",
        ["⅓"] = "1/3", ["⅔"] = "2/3", ["⅕"] = "1/5", ["⅖"] = "2/5", ["⅗"] = "3/5", ["⅘"] = "4/5",
        ["⅙"] = "1/6", ["⅚"] = "5/6", ["⅛"] = "1/8", ["⅜"] = "3/8", ["⅝"] = "5/8", ["⅞"] = "7/8",
    };

    private static readonly JsRe VULGAR_RE =
        JsRegex.Compile("[" + string.Concat(VULGAR.Keys) + "]", "gu");

    private static readonly JsRe AsciiDigit = JsRegex.Compile(@"\d", "u");

    /** Vulgar fraction characters → ASCII `n/m`, spaced off a preceding digit so a mixed number stays two terms. */
    public static string FoldVulgarFractions(string s)
    {
        if (!VULGAR_RE.IsMatch(s)) return s;
        return Rewrite(s, VULGAR_RE, m =>
            (AsciiDigit.IsMatch(m.Index > 0 ? s[m.Index - 1].ToString() : "") ? " " : "") + VULGAR[m.Value]);
    }

    private static readonly JsRe Celsius = JsRegex.Compile("℃", "gu");
    private static readonly JsRe Fahrenheit = JsRegex.Compile("℉", "gu");

    public static string FoldSquaredDegrees(string s) =>
        Rewrite(Rewrite(s, Celsius, "°C"), Fahrenheit, "°F");

    /**
     * FULLWIDTH LATIN LETTERS AND DIGITS → their ASCII twins (Ｇ→G, ７→7). They are `Script=Latin` letters with
     * NO decomposition, so the mark-stripping fold cannot reach them and a g2p with no rule DROPS them.
     *
     * ⚠ LETTERS AND DIGITS ONLY, not the whole fullwidth block. U+FF01–FF5E also holds fullwidth PUNCTUATION,
     * which the CJK engines already read deliberately — folding it would reach into decisions they have made.
     */
    private static readonly JsRe FULLWIDTH = JsRegex.Compile(@"[０-９Ａ-Ｚａ-ｚ]", "gu");

    public static string FoldFullwidthLatin(string s)
    {
        if (!FULLWIDTH.IsMatch(s)) return s;
        return Rewrite(s, FULLWIDTH, m => ((char)(m.Value[0] - 0xFEE0)).ToString());
    }
}

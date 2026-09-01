/**
 * Turkmen (tk) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THE DEFINING DEFECT IS THE SPANISH TILDE STANDING IN FOR THE CARON — ⟨ñ⟩ for ⟨ň⟩ ×157 against 1,892,
 * ⟨ÿ⟩ for ⟨ý⟩ ×6. Both letters are Latin, so unlike Chuvash's twin defect nothing SPLITS: the grapheme
 * scan simply has no rule and falls through to a plain [n], deleting the velar nasal from `-yň`, one of
 * the commonest suffixes in the language. Step 0 folds it, gated on the word being otherwise Turkmen.
 * Ported from src/languages/turkmen/normalize.ts — see that file for the corpus evidence, the fraction
 * the corpus writes both ways round, the clock rule that is deliberately absent, and the sourcing.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Turkmen;

public static class Normalize
{
    // ───────────────────────────────────────────────────────────────────────────────────────────────
    // ORDINALS — derived, not tabulated
    // ───────────────────────────────────────────────────────────────────────────────────────────────

    /** The cardinal as words — the same composer the engine's number path uses. */
    private static string Cardinal(double n) => string.Join(" ", Numbers.NumberToWords(n));

    private const string FRONT = "äeiöü";
    private const string ROUNDED = "oöuü";
    /** ⚠ ⟨ý⟩ IS NOT IN THIS SET, AND THAT IS THE POINT. It is the GLIDE [j], not a vowel — counting it as
     *  one made `ýüz` look disyllabic, suppressed the labial harmony and produced *ýüzinji* for
     *  *ýüzünji*. ⟨y⟩ (close back unrounded) IS a vowel and ⟨ý⟩ is not, and they differ by one accent. */
    private const string VOWELS = "aäeioöuüy";

    /**
     * The Turkmen ORDINAL. The writer types `-njy` or `-nji` and has therefore ALREADY CHOSEN the
     * backness; what the rule supplies is the LINKING VOWEL a consonant-final stem needs.
     *
     * ⚠ LABIAL HARMONY REACHES ONLY THE SECOND SYLLABLE. `on` is *onunjy* and `ýüz` is *ýüzünji* — both
     * monosyllables, so the suffix vowel IS the second syllable and rounds. `otuz` and `dokuz` are
     * disyllables whose suffix is the THIRD syllable, and they unround: *otuzynjy*, never *otuzunjy*.
     * Bashkir rounds by the vowel alone and Tatar does not round at all; Turkmen rounds by the vowel AND
     * the syllable count.
     *
     * ⚠ AND ONE STEM VOICES ITS FINAL STOP: `dört` → *dördünji*. Among the numerals only `dört` reaches
     * it — `kyrk` stays *kyrkynjy* — so it is the single exception it is written as.
     */
    public static string? OrdinalOf(double n, bool front)
    {
        if (!double.IsInteger(n) || n < 0) return null;
        var words = Cardinal(n).Split(' ').ToList();
        var last = words.Count > 0 ? words[^1] : null;
        if (last is null || last == "") return null;
        var suffix = front ? "nji" : "njy";
        if (VOWELS.Contains(last[^1], StringComparison.Ordinal))
        {
            words[^1] = last + suffix;
            return string.Join(" ", words);
        }
        if (last == "dört") last = "dörd";
        var vowels = last.Where(c => VOWELS.Contains(c, StringComparison.Ordinal)).ToList();
        if (vowels.Count == 0) return null;
        var v = vowels[^1];
        var round = ROUNDED.Contains(v, StringComparison.Ordinal) && vowels.Count == 1;
        var link = FRONT.Contains(v, StringComparison.Ordinal) ? (round ? "ü" : "i") : round ? "u" : "y";
        words[^1] = $"{last}{link}{suffix}";
        return string.Join(" ", words);
    }

    // ───────────────────────────────────────────────────────────────────────────────────────────────
    // INITIALISMS
    // ───────────────────────────────────────────────────────────────────────────────────────────────

    /**
     * Turkmen letter NAMES. The alphabet is the 1993 Latin one — the Turkish set plus ⟨ä ň ý ž⟩ and
     * without ⟨ı ğ⟩ — and its letters are named by their own sound plus a vowel, the Turkic convention.
     */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["a"] = "a", ["b"] = "be", ["ç"] = "çe", ["d"] = "de", ["e"] = "e", ["ä"] = "ä", ["f"] = "fe",
        ["g"] = "ge", ["h"] = "he", ["i"] = "i", ["j"] = "je", ["ž"] = "že", ["k"] = "ka", ["l"] = "el",
        ["m"] = "em", ["n"] = "en", ["ň"] = "eň", ["o"] = "o", ["ö"] = "ö", ["p"] = "pe", ["r"] = "er",
        ["s"] = "es", ["ş"] = "şe", ["t"] = "te", ["u"] = "u", ["ü"] = "ü", ["w"] = "we", ["y"] = "y",
        ["ý"] = "ýe", ["z"] = "ze",
    };

    /** Turkmen phonotactics, for the OOV rule in Core/Initialisms.cs. */
    public static readonly Func<string, bool> IsUnreadableTurkmen = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[aäeiouöüyý]", "u"),
        LegalOnsets = new HashSet<string>(
            ["br", "bl", "gr", "gl", "dr", "kr", "kl", "pl", "pr", "st", "sp", "sk", "tr"],
            StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(
            ["rk", "rt", "rd", "lt", "ld", "st", "şt", "nt", "nd", "ňk", "rs", "lk", "çt"],
            StringComparer.Ordinal),
    });

    private static readonly Func<string, string> INITIALISMS = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => LETTER_NAME.GetValueOrDefault(l),
        // Spelled out despite being pronounceable — the corpus's own runs.
        AcronymLetters = new HashSet<string>(
            ["abş", "bmg", "sssr", "tdng", "msz", "gar", "tmg", "htu", "httu"],
            StringComparer.Ordinal),
        IsRecorded = _ => false,
        IsUnreadable = IsUnreadableTurkmen,
    });

    public static string NormalizeTurkmenInitialisms(string text) => INITIALISMS(text);

    // ───────────────────────────────────────────────────────────────────────────────────────────────
    // The rules
    // ───────────────────────────────────────────────────────────────────────────────────────────────

    /** ⚠ EVERY BOUNDARY IN THIS FILE IS AN EXPLICIT LOOKAROUND, NEVER `\b` — `\b` is ASCII-defined and
     *  does not see ⟨ň ý ş ž ä ö ü⟩ as word characters, so it would cut Turkmen words in half (trap 1). */
    /** The Turkmen letters a written suffix can be spelt with. */
    private const string SFX = "[a-zäçžňöşüý]";

    // 0) THE TILDE FOLD. ⚠ THE GUARD IS THE WHOLE OF IT — ⟨ñ⟩ is a real letter of Spanish, Basque and
    //    Galician and ⟨ÿ⟩ of French and Dutch, so an unconditional fold would rewrite `España` inside a
    //    Turkmen sentence. A word qualifies only if every other letter in it is one Turkmen uses.
    private static readonly JsRe HAS_TILDE = JsRegex.Compile("[ñÿÑŸ]", "u");
    private static readonly JsRe WORD_RUN = JsRegex.Compile(@"[\p{L}\p{M}]+", "gu");
    private static readonly JsRe TK_LETTER = JsRegex.Compile("^[a-zäçžňöşüýñÿ]+$", "iu");
    private static readonly JsRe N_TILDE = JsRegex.Compile("ñ", "gu");
    private static readonly JsRe N_TILDE_UP = JsRegex.Compile("Ñ", "gu");
    private static readonly JsRe Y_DIAER = JsRegex.Compile("ÿ", "gu");
    private static readonly JsRe Y_DIAER_UP = JsRegex.Compile("Ÿ", "gu");

    public static string FoldTurkmenTildes(string input)
    {
        if (!HAS_TILDE.IsMatch(input)) return input;
        return Rewrite(input, WORD_RUN, m =>
        {
            var w = m.Value;
            if (!TK_LETTER.IsMatch(w)) return w;
            w = JsRegex.Replace(w, N_TILDE, "ň");
            w = JsRegex.Replace(w, N_TILDE_UP, "Ň");
            w = JsRegex.Replace(w, Y_DIAER, "ý");
            return JsRegex.Replace(w, Y_DIAER_UP, "Ý");
        });
    }

    /** 1) DIGIT DE-GROUPING — ⚠ THE WHOLE NUMBER AT ONCE, not one join per pass (trap 63); the trailing
     *  guard rejects a DIGIT and nothing else (trap 58). Separators spelled as escapes. */
    private static readonly JsRe GROUPED = JsRegex.Compile(
        "(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:[ \\u00a0\\u202f\\u2009]\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe SPACE_SEPS = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");  // space, NBSP, NNBSP, thin space

    /** 2) THE MAGNITUDE ABBREVIATIONS, before any single-dot rule. `mln` was reaching the g2p as a raw
     *  consonant cluster and the leak gate saw it. The dot is optional — the corpus writes both. */
    private static readonly JsRe MLRD = JsRegex.Compile(
        $"{Boundaries.NOT_LETTER_BEFORE}mlrd\\.?{Boundaries.NOT_LETTER_AFTER}", "giu");
    private static readonly JsRe MLN = JsRegex.Compile(
        $"{Boundaries.NOT_LETTER_BEFORE}mln\\.?{Boundaries.NOT_LETTER_AFTER}", "giu");

    /** 3) THE ERA MARKER, written five ways in the retained text with the tilde substitution cutting
     *  across them — which is why step 0 runs first. ⚠ THE `öň` FORM MUST BE TRIED BEFORE THE BARE
     *  `b.e.`, or the bare rule consumes the prefix and strands the "öň". */
    private static readonly (JsRe Re, string Word)[] MULTI =
    [
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}b\\.\\s?e\\.\\s?ö\\.()", "giu"), "biziň eramyzdan öň"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}b\\.\\s?e\\.\\s?öň(ki)?{Boundaries.NOT_LETTER_AFTER}", "giu"), "biziň eramyzdan öň"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}b\\.\\s?e\\.()(?=\\s|$)", "giu"), "biziň eramyz"),
    ];
    /** The FINAL dot is kept at a sentence end, or the pause is lost outright (trap 10). */
    private static readonly JsRe SENTENCE_END = JsRegex.Compile("^\\s*[\"\\u00bb)']?\\s*$", "u");

    /** 3b) PERCENT WITH A WRITTEN SUFFIX — the shared tier reads the sign but cannot see the `-ini`
     *  hanging off it, so the suffix was stranded as its own word. Claimed here, before the tier, which
     *  is the only place the figure and the suffix are still adjacent. */
    private static readonly JsRe PERCENT_SFX = JsRegex.Compile(
        $"(\\d+)\\s?%\\s?-\\s?({SFX}{{1,5}}){Boundaries.NOT_LETTER_AFTER}", "gu");

    /** 3c) THE YEAR ABBREVIATION `ý.`. ⚠ Anchored on a preceding DIGIT, because a bare `ý` is also the
     *  commonest letter in the language. */
    private static readonly JsRe YEAR_ABBREV = JsRegex.Compile(
        $"(\\d)\\s?ý\\.?{Boundaries.NOT_LETTER_AFTER}", "gu");

    /** 4) THE NUMBER SIGN — dropped outright. */
    private static readonly JsRe NUMERO = JsRegex.Compile("№\\s?(?=\\d)", "gu");

    /** 5) NUMERAL + THE ORDINAL SUFFIX. ⚠ THE ALTERNATION IS ANCHORED ON `nj`, not opened to any letter
     *  run: this corpus writes no bare case suffix on a figure, so an open alternation would have nothing
     *  to gain and every space-separated noun to lose. MUST run before the range rule (step 9). */
    private static readonly JsRe NUM_ORDINAL = JsRegex.Compile(
        $"(?<![\\d.,])(\\d+)\\s?-\\s?((?:[yiuü])?nj[yi]{SFX}{{0,6}}){Boundaries.NOT_LETTER_AFTER}", "giu");

    /** 6) THE FRACTION, and ⚠ ONLY WHERE THE READING IS UNAMBIGUOUS — this corpus writes the Turkic
     *  denominator-first order and the ordinary order in the same 430 segments, and the only thing
     *  separating them is that every reversed instance has numerator > denominator. */
    private static readonly JsRe FRACTION = JsRegex.Compile(
        "(?<![\\d.,/])(\\d{1,2})\\s?/\\s?(\\d{1,2})(?![\\d.,/])", "gu");

    /** 7) SIGNS. ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT a `+`, so no `+` rule can match inside it. */
    private static readonly JsRe MINUS = JsRegex.Compile("(^|(?<!\\d)[\\s(])[-\\u2212\\u2013]\\s?(\\d)", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("\\u00b1", "gu");
    private static readonly JsRe PLUS = JsRegex.Compile("(^|[\\s(])\\+\\s?(\\d)", "gu");

    /** 8) DEGREES — BOTH thermal and angular here, which is why the coordinate pair is claimed first. The
     *  corpus GLOSSES the sign by writing the word beside it ("+11° gradus"), so `gradus` is not an
     *  inference — and the bare-sign rule must not DOUBLE the word the corpus already wrote.
     *  ⚠ THE LOWERCASE SCALE LETTER GOES IN THE CLASS, NOT IN AN `i` FLAG — the suffix class beside it is
     *  genuinely lowercase-only, and `i` folds it so the flag would widen the suffix capture too. */
    private static readonly JsRe COORD_DMS = JsRegex.Compile(
        "(\\d)\\s?°\\s?(\\d+)\\s?[\\u2032']\\s?(\\d+)\\s?[\\u2033\"]", "gu");
    private static readonly JsRe COORD_DM = JsRegex.Compile("(\\d)\\s?°\\s?(\\d+)\\s?[\\u2032']", "gu");
    private static readonly JsRe DEG_C_SFX = JsRegex.Compile(
        $"(\\d)\\s?°\\s?[Cc]\\s?-\\s?({SFX}{{1,4}}){Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?°\\s?F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_ABLATIVE = JsRegex.Compile("(\\d)\\s?°\\s?(dan|den)(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d)\\s?°(?!\\s*gradus)", "gu");
    private static readonly JsRe DEG_GLOSSED = JsRegex.Compile("(\\d)\\s?°(?=\\s*gradus)", "gu");

    /** 9) NUMERIC RANGES. ⚠ THE DASH IS SPENT ON A PAUSE RATHER THAN A CONNECTIVE, the same measured
     *  refusal ba, kk, tt and chv make. ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58). */
    private static readonly JsRe SLASH_RANGE = JsRegex.Compile("(?<![\\d.,])(\\d+)\\s?/\\s?(?=\\d)", "gu");
    private static readonly JsRe DASH_RANGE = JsRegex.Compile("(\\d)\\s?[\\u2013\\u2014]\\s?(?=\\d)", "gu");
    private static readonly JsRe HYPHEN_RANGE = JsRegex.Compile("(?<![\\d.,])(\\d+)\\s?-\\s?(?=\\d)", "gu");

    private static readonly JsRe WS_RUN = JsRegex.Compile("[^\\S\\n]{2,}", "gu");

    /**
     * Attach a written ordinal suffix to a figure. The suffix the writer typed may carry a case ending
     * past the ordinal's own tail, so the rule derives the ordinal and splices on the OVERLAP rather than
     * testing `EndsWith`.
     */
    private static string AttachOrdinal(string whole, string digits, string rawSuffix)
    {
        var n = Js.Number(digits);
        // JS `Number.isSafeInteger(n)`: an integral double inside ±2^53 − 1.
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991.0)) return whole;
        var suffix = Js.ToLowerCase(rawSuffix);
        var front = suffix.StartsWith("nji", StringComparison.Ordinal)
            || suffix.StartsWith("inji", StringComparison.Ordinal)
            || suffix.StartsWith("ünji", StringComparison.Ordinal);
        var ord = OrdinalOf(n, front);
        if (ord is null) return whole;
        for (var k = Math.Min(ord.Length, suffix.Length); k >= 3; k--)
            if (ord.EndsWith(suffix[..k], StringComparison.Ordinal)) return ord + suffix[k..];
        return whole;
    }

    /** Normalize one Turkmen input string. Pure text→text. Steps are ORDER-DEPENDENT. */
    public static string NormalizeTurkmen(string input)
    {
        // 0) The tilde fold, FIRST — every later rule that names a Turkmen word (the era marker's `öň`,
        //    the ordinal's own output) has to see the letters the language actually uses.
        var s = FoldTurkmenTildes(input);

        // 1) Digit de-grouping.
        s = Rewrite(s, GROUPED, m => m.Groups[1].Value + SPACE_SEPS.Replace(m.Groups[2].Value, ""));
        s = Rewrite(s, SPACE_SEPS, " ");

        // 2) The magnitude abbreviations.
        s = Rewrite(s, MLRD, "milliard");
        s = Rewrite(s, MLN, "million");

        // 3) The era marker.
        foreach (var (re, word) in MULTI)
        {
            var full = s;
            s = Rewrite(s, re, m =>
            {
                var outp = $"{word}{(m.Groups[1].Success ? m.Groups[1].Value : "")}";
                var rest = full[(m.Index + m.Length)..];
                return SENTENCE_END.IsMatch(rest) ? $"{outp}." : outp;
            });
        }

        // 3b) Percent with a written suffix. The word is the tier's own `göterim`, repeated deliberately
        //     rather than left to a rule that cannot reach.
        s = Rewrite(s, PERCENT_SFX, "$1 göterim$2");

        // 3c) The year abbreviation `ý.`.
        s = Rewrite(s, YEAR_ABBREV, "$1 ýyl");

        // 4) The number sign.
        s = Rewrite(s, NUMERO, "belgi ");

        // 5) Numeral + the ordinal suffix.
        s = Rewrite(s, NUM_ORDINAL, m => AttachOrdinal(m.Value, m.Groups[1].Value, m.Groups[2].Value));

        // 6) The fraction — Turkmen reads it *<denominator-locative> <numerator>*, "üçden bir", with the
        //    denominator taking `-dan/-den` by the same harmony the ordinal uses.
        s = Rewrite(s, FRACTION, m =>
        {
            var nv = Js.Number(m.Groups[1].Value);
            var dv = Js.Number(m.Groups[2].Value);
            if (!(nv >= 1 && nv < dv && dv <= 12)) return m.Value;
            var dw = Cardinal(dv);
            var vowels = dw.Where(c => VOWELS.Contains(c, StringComparison.Ordinal)).ToList();
            if (vowels.Count == 0) return m.Value;
            var v = vowels[^1];
            return $"{dw}{(FRONT.Contains(v, StringComparison.Ordinal) ? "den" : "dan")} {Cardinal(nv)}";
        });

        // 7) Signs.
        s = Rewrite(s, MINUS, "$1minus $2");
        s = Rewrite(s, PLUS_MINUS, " plýus minus ");
        s = Rewrite(s, PLUS, "$1plýus $2");

        // 8) Degrees.
        s = Rewrite(s, COORD_DMS, "$1 gradus $2 minut $3 sekunt ");
        s = Rewrite(s, COORD_DM, "$1 gradus $2 minut ");
        // ⚠ `Selsi`, not `Selsiý` — the corpus's own "0 K (Kelwin)= -273,15°C (gradus Selsi)" supplies the
        // word, the compound order and the notation together; `Selsiý` scores 0.
        s = Rewrite(s, DEG_C_SFX, "$1 gradus Selsi$2");
        s = Rewrite(s, DEG_C, "$1 gradus Selsi");
        s = Rewrite(s, DEG_F, "$1 gradus Farengeýt");
        s = Rewrite(s, DEG_ABLATIVE, "$1 gradus$2");
        s = Rewrite(s, DEG_BARE, "$1 gradus ");
        s = Rewrite(s, DEG_GLOSSED, "$1 ");

        // 9) Numeric ranges — the slash AFTER the fraction rule has had its chance at it.
        s = Rewrite(s, SLASH_RANGE, "$1, ");
        s = Rewrite(s, DASH_RANGE, "$1, ");
        s = Rewrite(s, HYPHEN_RANGE, "$1, ");

        // A padded replacement (` plýus minus `) doubles a space that was already there. Harmless
        // downstream because AssembleClauses collapses runs, but SLOT-GAP is a defect class and this pass
        // should not be the one producing candidates for it.
        return Rewrite(s, WS_RUN, " ");
    }
}

/**
 * Fula (ff) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA. The steps are ORDER-DEPENDENT.
 * Ported from src/languages/fula/normalize.ts — see that file for the corpus evidence, for every attested
 * word, and for the couplings each step states.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Fula;

public static class Normalize
{
    // ─────────────────────────────────────────────────────────────────────────────────────────────────
    // DATA
    // ─────────────────────────────────────────────────────────────────────────────────────────────────

    /** Fula letter names — the standard Boko alphabet, per the UNESCO Bamako alphabet. */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["a"] = "a", ["b"] = "ba", ["c"] = "ca", ["d"] = "da", ["e"] = "e", ["f"] = "fa", ["g"] = "ga",
        ["h"] = "ha", ["i"] = "i", ["j"] = "ja", ["k"] = "ka", ["l"] = "la", ["m"] = "ma", ["n"] = "na",
        ["o"] = "o", ["p"] = "pa", ["q"] = "ka", ["r"] = "ra", ["s"] = "sa", ["t"] = "ta", ["u"] = "u",
        ["v"] = "va", ["w"] = "wa", ["x"] = "eka", ["y"] = "ya", ["z"] = "za", ["ɓ"] = "ɓa", ["ɗ"] = "ɗa",
        ["ŋ"] = "ŋa", ["ɲ"] = "ɲa", ["ƴ"] = "ƴa",
    };

    /** Fula phonotactics, for the OOV rule in core/initialisms.ts (can this letter run be a word at all?). */
    public static readonly Func<string, bool> IsUnreadableFula = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[aeiouɓɗŋɲƴ]", "u"),
        LegalOnsets = new HashSet<string>(new[]
        {
            "mb", "nd", "nj", "ng", "ny", "ƴ", "ɓ", "ɗ", "h", "j", "k", "l", "m", "n", "p", "r",
            "s", "t", "w", "y",
            "ch", "sh", "ts", "dy", "kw", "br", "gr", "pr", "tr", "sk", "fr", "st",
        }, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(new[]
        {
            "b", "d", "f", "g", "h", "k", "l", "m", "n", "p", "r", "s", "t", "w", "y", "mb", "nd",
            "ng", "nj", "ny",
            "ks", "sk", "ns", "ms", "ls", "sh", "ll", "st", "ts",
        }, StringComparer.Ordinal),
        // ONE phoneme each — see PhonotacticsData.Digraphs.
        Digraphs = new HashSet<string>(new[] { "mb", "nd", "ng", "nj", "ny", "ch", "sh", "ɓ", "ɗ", "ƴ" }, StringComparer.Ordinal),
    });

    /** Lexical: acronyms READ AS WORDS despite being unreadable by phonotactics. */
    private static readonly IReadOnlySet<string> WORD_ACRONYMS =
        new HashSet<string>(new[] { "nasa", "eua" }, StringComparer.Ordinal);

    private static readonly Func<string, string> NormalizeInitialisms = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => LETTER_NAME.GetValueOrDefault(l.ToLowerInvariant()),
        AcronymLetters = new HashSet<string>(new[]
        {
            "mri", "oha", "acma", "rem", "us", "usa", "usaf", "fbi", "cia", "nsa", "faa", "bbc",
            "cnn", "cbs", "nba", "nfl", "nhl", "mlb", "mls", "gps", "dna", "hiv", "aids", "pdf", "dvd",
            "cd", "tv", "pc", "h5n1", "a1gp", "u.s.", "u.s", "un", "eu",
        }, StringComparer.Ordinal),
        IsRecorded = w => WORD_ACRONYMS.Contains(w),
        IsUnreadable = w => IsUnreadableFula(w),
    });

    // ─────────────────────────────────────────────────────────────────────────────────────────────────
    // THE FULA ORDINAL
    // ─────────────────────────────────────────────────────────────────────────────────────────────────

    /** Ordinal 1–9: the cardinal stem + -aɓal (gootal is SUPPLETIVE for 1). */
    private static readonly IReadOnlyDictionary<double, string> ORD_1_9 = new Dictionary<double, string>
    {
        [1] = "gootal", [2] = "ɗiɗaɓal", [3] = "tataɓal", [4] = "nayaɓal", [5] = "joyaɓal",
        [6] = "jeegaɓal", [7] = "jeeɗiɗaɓal", [8] = "jeetataɓal", [9] = "jeenayaɓal",
    };

    /** The ordinal of a CARDINAL WORD when it ends a compound: the stem (final vowel dropped) + -aɓal. */
    private static readonly IReadOnlyDictionary<string, string> STEM_ORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["goo"] = "gootal", ["ɗiɗi"] = "ɗiɗaɓal", ["tati"] = "tataɓal", ["nayi"] = "nayaɓal", ["joyi"] = "joyaɓal",
        ["jeegom"] = "jeegaɓal", ["jeeɗiɗi"] = "jeeɗiɗaɓal", ["jeetati"] = "jeetataɓal", ["jeenayi"] = "jeenayaɓal",
        ["sappo"] = "sappaɓal", ["noogaas"] = "noogaasaɓal", ["cappanɗe"] = "cappanɗaɓal", ["teemedere"] = "teemederaɓal",
        ["teemedde"] = "teemeddaɓal", ["ujundere"] = "ujunderaɓal", ["ujunaaje"] = "ujunajaɓal",
        // Derived from the compositor's constants — hand-copied keys drifted once and went dead.
        [FulaNumbers.MILLION] = FulaNumbers.MILLION + "aɓal", [FulaNumbers.BILLION] = FulaNumbers.BILLION + "aɓal",
    };

    private static readonly JsRe DIGIT_TEST = JsRegex.Compile(@"\d", "u");

    /**
     * Integer → the Fula ordinal: the cardinal with the LAST element's ordinal. Null (TS `undefined`) when
     * out of range or when the last cardinal word has no stem entry.
     */
    public static string? OrdinalWords(double n)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 1 || n >= 1e12) return null;
        if (n <= 9) return ORD_1_9.GetValueOrDefault(n);
        var card = FulaNumbers.NumberToWords(n);
        if (card == "" || DIGIT_TEST.IsMatch(card)) return null;
        var words = card.Split(' ');
        var last = words[^1];
        if (!STEM_ORD.TryGetValue(last, out var ord)) return null;
        words[^1] = ord;
        return string.Join(" ", words);
    }

    // ─────────────────────────────────────────────────────────────────────────────────────────────────
    // THE PASS
    // ─────────────────────────────────────────────────────────────────────────────────────────────────

    private static readonly JsRe AMP_ENTITY = JsRegex.Compile(@"&amp;", "giu");
    private static readonly JsRe AUD = JsRegex.Compile(@"(?<![\p{L}\p{M}])AUD\$?(?=\s?\d)", "giu");
    private static readonly JsRe USD = JsRegex.Compile(@"(?<![\p{L}\p{M}])(?:US|uS)\$?(?=\s?\d)", "giu");
    private static readonly JsRe ERA = JsRegex.Compile(@"(?<!\d)(\d[\d,]*)B\.?C\.?(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe DOTTED_CAPS = JsRegex.Compile(@"(?<![\p{L}\p{M}])\p{Lu}\.(?:[ \u00a0]?\p{Lu}\.)+", "gu");  // space, NBSP
    private static readonly JsRe DOTTED_CAPS_STRIP = JsRegex.Compile(@"[.\s]", "gu");
    private static readonly JsRe SUFFIX_DOT = JsRegex.Compile(@"(?<=\p{Lu})\.(?=\s+\p{Lu})", "gu");
    private static readonly JsRe ORDINAL = JsRegex.Compile(@"(?<![\d.,])(\d[\d,]*)(st|nd|rd|th)(?![\p{L}\p{M}])", "giu");
    // ⚠ Each operand must END ON A DIGIT — see the TS. A trailing separator let `1,` match and the
    // range rule claimed the minus of `1, -2`, reading a range where the text has a negative number.
    private static readonly JsRe RANGE = JsRegex.Compile(@"(?<![\d.,])(\d(?:[\d,]*\d)?)\s*[-–]\s*(\d(?:[\d,]*\d)?)(?![\d.])", "gu");
    private static readonly JsRe CLOCK_SUFFIX = JsRegex.Compile(@"(?<![\d.,])(\d{1,2}):(\d{2})(nje)(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe CLOCK = JsRegex.Compile(
        @"(?<![\d:,])(\d{1,2}):(\d{2})(?![:.\d])(?:\s*([Aa]\.?[Mm]\.?|[Pp]\.?[Mm]\.?))?", "giu");
    private static readonly JsRe CLOCK_DOT_TZ = JsRegex.Compile(@"(?<![\d.,])(\d{1,2})\.(\d{2})\s*(UTC|GMT)", "giu");
    private static readonly JsRe GIGAHERTZ = JsRegex.Compile(@"(?<![\d.,])(\d+\.\d+)\s?Ghz?(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe DECIMAL_UNIT = JsRegex.Compile(
        @"(?<![\d.,])(\d+)\.(\d+)\s?(km|m|kg|mm|cm|mph|kph)(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe DECIMAL_DOT = JsRegex.Compile(@"(?<![\d.,])(\d+)\.(\d+)(?![\d.])", "giu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile(@"(?<![\d.,])(\d+),(\d{1,2})(?![\d,])", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile(@"(?<![\d/])(\d{1,3})\/(\d{1,3})(?![\d/])", "gu");
    private static readonly JsRe DEGREE_C = JsRegex.Compile(@"(\d)\s?[°º]\s?C(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe DEGREE_F = JsRegex.Compile(@"(\d)\s?[°º]\s?F(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe DEGREE = JsRegex.Compile(@"(\d)\s?[°º](?![\p{L}\p{M}])", "gu");
    // ⚠ ONLY `/h` — see the TS. `/s` asserted an hour rate through two identical ternary branches.
    private static readonly JsRe RATE = JsRegex.Compile(@"(?<!\d)(\d+)\s?(km|m|kg|mm|cm)\s*\/\s*(h)(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe RATE_WORD = JsRegex.Compile(@"(?<!\d)(\d+)\s?(mph|kph)(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe RATE_TYPO = JsRegex.Compile(@"(?<!\d)(\d+)o\s?(km\/h)(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe PLUS = JsRegex.Compile(@"\+\s?(?=\d)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile(@"(?<![\p{L}\p{Nd}])[-−](\d+)(?!\s*[-\d])", "gu");
    private static readonly JsRe AMP_CAPS = JsRegex.Compile(@"(?<![\p{L}\p{M}])(\p{Lu})&(\p{Lu})(s?)(?![\p{L}\p{M}])", "gu");
    private static readonly JsRe AMP_SPACED = JsRegex.Compile(@"\s&\s", "gu");
    private static readonly JsRe TIMES = JsRegex.Compile(@"(\d)\s*×\s*(\d)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile(@"(\S)\s*=\s*(\S)", "gu");
    private static readonly JsRe LESS = JsRegex.Compile(@"(\d)\s*<\s*(\d)", "gu");
    private static readonly JsRe GREATER = JsRegex.Compile(@"(\d)\s*>\s*(\d)", "gu");
    private static readonly JsRe PERCENT = JsRegex.Compile(
        @"(\d+(?: toɓɓere [\p{L}\p{M}]+)+|[\p{L}\p{M}]+ toɓɓere [\p{L}\p{M}]+|\d+)\s*%\s*(?![\p{L}\p{M}])", "gu");

    private static readonly JsRe GROUPING_COMMA = JsRegex.Compile(@",", "gu");

    /** The units the dot-decimal rule spells out (step 7). */
    private static readonly IReadOnlyDictionary<string, string> DECIMAL_UNIT_WORDS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km"] = "kilometre", ["m"] = "metre", ["kg"] = "kilogram", ["mm"] = "milimeta", ["cm"] = "santimeta",
        ["mph"] = "miles e wakkati gootel", ["kph"] = "kilometre e wakkati gootel",
    };

    /** The units the rate rule spells out (step 10). */
    private static readonly IReadOnlyDictionary<string, string> RATE_UNIT_WORDS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km"] = "kilometre", ["m"] = "metre", ["kg"] = "kilogram", ["mm"] = "milimeta", ["cm"] = "santimeta",
    };

    /** The fraction digits of a decimal, read one at a time. */
    private static string SpellDigits(string f) =>
        string.Join(" ", Js.CodePoints(f).Select(d => FulaNumbers.NumberToWords(Js.Number(d))));

    /** Normalize one Fula input string. Pure text→text. Steps are ORDER-DEPENDENT; see the TS. */
    public static string NormalizeFula(string input)
    {
        var s = input;

        // 1) HTML ENTITIES — FIRST, before the ampersand rule.
        s = Rewrite(s, AMP_ENTITY, " e ");

        // 1b) CURRENCY PREFIXES — AFTER &amp;, BEFORE the number rules.
        s = Rewrite(s, AUD, "dollar Awstraliya ");
        s = Rewrite(s, USD, "dollar Amerik ");

        // 2) ERA MARKERS — `1000B.C.`.
        s = Rewrite(s, ERA, "$1 ɓawo");

        // 3) DOTTED CAPITAL RUNS → a bare all-caps run, so the initialism pass reads them as LETTERS.
        s = Rewrite(s, DOTTED_CAPS, m0 => DOTTED_CAPS_STRIP.Replace(m0.Value, ""));
        s = Rewrite(s, SUFFIX_DOT, "");

        // 4) ORDINALS — the English `Nst`/`Nnd`/`Nrd`/`Nth` form. BEFORE the clock rule.
        s = Rewrite(s, ORDINAL, m =>
        {
            var n = Js.Number(GROUPING_COMMA.Replace(m.Groups[1].Value, ""));
            if (double.IsNaN(n) || double.IsInfinity(n) || n < 1) return m.Value;
            return OrdinalWords(n) ?? m.Value;
        });

        // 5) RANGES and SCORES — read with `haa` (up to). A leading minus stays a sign (handled later).
        s = Rewrite(s, RANGE, "$1 haa $2");

        // 5b) GLUED CLOCK SUFFIX — `11:00nje`.
        s = Rewrite(s, CLOCK_SUFFIX, "$1:$2 $3");

        // 6) CLOCK, in the COLON form.
        s = Rewrite(s, CLOCK, m =>
        {
            double hv = Js.Number(m.Groups[1].Value), mv = Js.Number(m.Groups[2].Value);
            if (hv > 23 || mv > 59) return m.Value;
            var head = mv == 0
                ? FulaNumbers.NumberToWords(hv)
                : $"{FulaNumbers.NumberToWords(hv)} e {FulaNumbers.NumberToWords(mv)}";
            var apLower = (m.Groups[3].Success ? m.Groups[3].Value : "").ToLowerInvariant();
            var suffix = apLower.StartsWith("p", StringComparison.Ordinal) ? " kikiiɗe"
                : apLower.StartsWith("a", StringComparison.Ordinal) ? " fajiri" : "";
            return $"{head}{suffix}";
        });

        // 6b) CLOCK, in the DOT form before a timezone — `15.00 UTC`.
        s = Rewrite(s, CLOCK_DOT_TZ, m =>
        {
            double hv = Js.Number(m.Groups[1].Value), mv = Js.Number(m.Groups[2].Value);
            var head = mv == 0
                ? FulaNumbers.NumberToWords(hv)
                : $"{FulaNumbers.NumberToWords(hv)} e {FulaNumbers.NumberToWords(mv)}";
            return $"{head} {m.Groups[3].Value}";
        });

        // 7) VERSION DOTS and DOT DECIMALS. GIGAHERTZ is claimed FIRST on the raw digits. AFTER the clock.
        s = Rewrite(s, GIGAHERTZ, "$1 gigahertz");
        s = Rewrite(s, DECIMAL_UNIT, m =>
            $"{m.Groups[1].Value} toɓɓere {SpellDigits(m.Groups[2].Value)} " +
            DECIMAL_UNIT_WORDS[m.Groups[3].Value.ToLowerInvariant()]);
        s = Rewrite(s, DECIMAL_DOT, m => $"{m.Groups[1].Value} toɓɓere {SpellDigits(m.Groups[2].Value)}");

        // 7c) COMMA-DECIMALS — `12,5`; a comma before a THREE-digit group is thousands and stays.
        s = Rewrite(s, DECIMAL_COMMA, m => $"{m.Groups[1].Value} toɓɓere {SpellDigits(m.Groups[2].Value)}");

        // 8) FRACTIONS.
        s = Rewrite(s, FRACTION, m =>
            $"{FulaNumbers.NumberToWords(Js.Number(m.Groups[1].Value), m.Groups[1].Value)} e {FulaNumbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value)}");

        // 9) DEGREES.
        s = Rewrite(s, DEGREE_C, "$1 digiri Celsius");
        s = Rewrite(s, DEGREE_F, "$1 digiri Fahrenheit");
        s = Rewrite(s, DEGREE, "$1 digiri");

        // 10) RATES. AFTER the version-dot rule, BEFORE the tier.
        s = Rewrite(s, RATE, m =>
            $"{FulaNumbers.NumberToWords(Js.Number(m.Groups[1].Value), m.Groups[1].Value)} " +
            $"{RATE_UNIT_WORDS[m.Groups[2].Value.ToLowerInvariant()]} e wakkati gootel");
        s = Rewrite(s, RATE_WORD, m =>
            $"{FulaNumbers.NumberToWords(Js.Number(m.Groups[1].Value), m.Groups[1].Value)} " +
            (m.Groups[2].Value.ToLowerInvariant() == "mph" ? "miles e wakkati gootel" : "kilometre e wakkati gootel"));
        s = Rewrite(s, RATE_TYPO, m =>
            $"{FulaNumbers.NumberToWords(Js.Number(m.Groups[1].Value), m.Groups[1].Value)} kilometre e wakkati gootel");

        // 11) GIGAHERTZ — handled in step 7 on the raw digits (before the fraction becomes words).

        // 12) SIGNS.
        s = Rewrite(s, PLUS, " e gooto ");
        s = Rewrite(s, MINUS, "usta $1");
        s = Rewrite(s, AMP_CAPS, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            return $"{LETTER_NAME.GetValueOrDefault(a.ToLowerInvariant()) ?? a} e " +
                   $"{LETTER_NAME.GetValueOrDefault(b.ToLowerInvariant()) ?? b}{m.Groups[3].Value}";
        });
        s = Rewrite(s, AMP_SPACED, " e ");
        s = Rewrite(s, TIMES, "$1 je $2");
        s = Rewrite(s, EQUALS, "$1 fota $2");
        s = Rewrite(s, LESS, "$1 famɗi $2");
        s = Rewrite(s, GREATER, "$1 ɓuri $2");
        s = Rewrite(s, PERCENT, "$1 e teemedere");

        // 13) INITIALISMS, LAST of the letter rules.
        s = NormalizeInitialisms(s);

        return s;
    }
}

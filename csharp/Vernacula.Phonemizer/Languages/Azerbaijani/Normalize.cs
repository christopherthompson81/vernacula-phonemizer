/**
 * Azerbaijani (az) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the pipeline speaks. Pure text→text; no IPA. Steps are ORDER-DEPENDENT.
 * Ported from src/languages/azerbaijani/normalize.ts — see that file for the corpus evidence and the
 * per-step coupling notes.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Azerbaijani;

public static class Normalize
{
    private static readonly JsRe VOWEL = JsRegex.Compile("[aıeiəouöü]", "u");

    /** Four-way vowel harmony: the high vowel a suffix takes after each possible last stem vowel. */
    private static readonly IReadOnlyDictionary<string, string> HIGH = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["a"] = "ı", ["ı"] = "ı", ["e"] = "i", ["ə"] = "i", ["i"] = "i",
        ["o"] = "u", ["u"] = "u", ["ö"] = "ü", ["ü"] = "ü",
    };

    /** Two-way LOW harmony: `a` after a back stem vowel, `ə` after a front one. */
    private static readonly IReadOnlyDictionary<string, string> LOW = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["a"] = "a", ["ı"] = "a", ["o"] = "a", ["u"] = "a",
        ["e"] = "ə", ["ə"] = "ə", ["i"] = "ə", ["ö"] = "ə", ["ü"] = "ə",
    };

    private static readonly JsRe HIGH_V = JsRegex.Compile("[ıiuü]", "u");
    private static readonly JsRe LOW_V = JsRegex.Compile("[aə]", "u");

    /**
     * Rewrite a WRITTEN suffix so it agrees with the stem it will be spoken against: high vowels take the
     * four-way class, low vowels the two-way class, and a vowel-initial suffix after a vowel-final stem
     * gets the buffer `y`.
     */
    private static string HarmoniseSuffix(string stem, string suffix)
    {
        var v = LastVowelOf(stem);
        if (v is null || suffix == "") return suffix;
        string hi = HIGH[v], lo = LOW[v];
        var body = string.Concat(Js.CodePoints(suffix).Select(c => HIGH_V.IsMatch(c) ? hi : LOW_V.IsMatch(c) ? lo : c));
        var buffer = VOWEL.IsMatch(stem[^1].ToString()) && VOWEL.IsMatch(body[0].ToString()) ? "y" : "";
        return $"{buffer}{body}";
    }

    private static string? LastVowelOf(string w)
    {
        for (var i = w.Length - 1; i >= 0; i--) if (VOWEL.IsMatch(w[i].ToString())) return w[i].ToString();
        return null;
    }

    private static readonly JsRe HAS_DIGIT = JsRegex.Compile(@"\d", "u");

    /**
     * Integer → the Azerbaijani ORDINAL, i.e. the cardinal with the ordinal suffix on its LAST word:
     * 18 → `on səkkizinci`, 190 → `yüz doxsanıncı`, 1000 → `mininci`.
     */
    public static string? OrdinalWords(double n)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0) return null;
        var card = AzerbaijaniNumbers.NumberToWords(n);
        if (card == "" || HAS_DIGIT.IsMatch(card)) return null;
        var words = card.Split(' ');
        var stem = words[^1];
        var v = LastVowelOf(stem);
        if (v is null) return null;
        var h = HIGH[v];
        words[^1] = VOWEL.IsMatch(stem[^1].ToString()) ? $"{stem}nc{h}" : $"{stem}{h}nc{h}";
        return string.Join(" ", words);
    }

    /** Multi-dot abbreviations and era markers, handled BEFORE the single-dot rule. ⚠ ORDER IS LOAD-BEARING:
     *  `b.e.ə.` ends in `e.ə.` and the shorter entry's lookbehind rejects only a letter, so it must go first. */
    private static readonly (string Body, string Word)[] MULTI_DOT =
    {
        (@"b\.\s?e\.\s?ə\.", "eramızdan əvvəl"),
        (@"e\.\s?ə\.", "eramızdan əvvəl"),
        (@"E\.\s?ə\.", "eramızdan əvvəl"),
        (@"b\.\s?e\.", "bizim eramız"),
        (@"\bBE(?=\s+\d)", "bizim eramız"),
    };

    /** The MULTI_DOT patterns, compiled once in the order the pass applies them (end-of-phrase, then bare). */
    private static readonly (JsRe End, JsRe Bare, string Word)[] MULTI_DOT_RE = MULTI_DOT
        .Select(e => (JsRegex.Compile($@"(?<![\p{{L}}\p{{M}}]){e.Body}(?=\s*$)", "giu"),
                      JsRegex.Compile($@"(?<![\p{{L}}\p{{M}}]){e.Body}", "giu"),
                      e.Word))
        .ToArray();

    /** Single-dot abbreviations → the spoken words. */
    private static readonly IReadOnlyDictionary<string, string> DOTTED_ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["dr"] = "Doktor",
        ["prof"] = "Professor",
        ["şək"] = "şəkil",
    };

    /** Azerbaijani letter names — the standard alphabet. The g2p spells them through itself. */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["a"] = "a", ["b"] = "be", ["c"] = "ce", ["ç"] = "çe", ["d"] = "de", ["e"] = "e", ["ə"] = "ə",
        ["f"] = "fe", ["g"] = "ge", ["ğ"] = "ğe", ["h"] = "he", ["x"] = "xı", ["ı"] = "ı", ["i"] = "i",
        ["j"] = "je", ["k"] = "ke", ["q"] = "qe", ["l"] = "el", ["m"] = "em", ["n"] = "en", ["o"] = "o",
        ["ö"] = "ö", ["p"] = "pe", ["r"] = "er", ["s"] = "se", ["ş"] = "şe", ["t"] = "te", ["u"] = "u",
        ["ü"] = "ü", ["v"] = "ve", ["y"] = "ye", ["z"] = "ze",
    };

    /** Azerbaijani phonotactics, for the OOV rule in Core/Initialisms.cs. */
    public static readonly Func<string, bool> IsUnreadableAzerbaijani = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[aıeiəouöü]", "u"),
        LegalOnsets = new HashSet<string>(new[]
        {
            "bl", "br", "dr", "dv", "fl", "fr", "gl", "gr", "kl", "kr", "kv", "pl", "pr", "ps", "sk",
            "sl", "sm", "sn", "sp", "st", "sv", "tr", "ts", "tv", "xl", "xm", "xn", "xs",
        }, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(new[]
        {
            "ft", "kt", "ks", "ld", "lf", "lk", "lm", "lp", "ls", "lt", "mp", "ms", "mt", "nd", "ng",
            "nk", "ns", "nt", "pt", "rd", "rf", "rk", "rl", "rm", "rn", "rp", "rs", "rt", "sk", "sp",
            "st", "ts", "xt",
        }, StringComparer.Ordinal),
    });

    /** Lexical: acronyms READ AS WORDS despite being unreadable by phonotactics. */
    private static readonly IReadOnlySet<string> WORD_ACRONYMS =
        new HashSet<string>(new[] { "abş", "nasa", "unesco", "aol", "covid", "fiba", "opec", "rem" }, StringComparer.Ordinal);

    private static readonly Func<string, string> NormalizeInitialisms = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        Lower = G2p.AzLower,
        LetterName = l => LETTER_NAME.GetValueOrDefault(G2p.AzLower(l)),
        AcronymLetters = new HashSet<string>(
            new[] { "bmt", "gps", "ms", "knp", "cep", "mt", "mri", "dnt", "ftb", "cctv", "dvd", "pbs", "utc", "gmt" },
            StringComparer.Ordinal),
        IsRecorded = w => WORD_ACRONYMS.Contains(w),
        IsUnreadable = IsUnreadableAzerbaijani,
    });

    // ── The step patterns. The TS builds them inline; JsRegex.Compile caches, so hoisting is a readability
    //    choice and not a behaviour one.
    private static readonly JsRe DOTTED_CAPS = JsRegex.Compile(@"(?<![\p{L}\p{M}])\p{Lu}\.(?:[ \u00a0]?\p{Lu}\.)+", "gu");
    private static readonly JsRe DOTS_AND_SPACE = JsRegex.Compile(@"[.\s]", "gu");
    private static readonly JsRe INITIAL_DOT = JsRegex.Compile(@"(?<=\p{Lu})\.(?=\s+\p{Lu})", "gu");
    private static readonly JsRe ABBREV_MID = JsRegex.Compile(@"(?<![\p{L}\p{M}])(dr|prof|şək)\.(\s+)(?=[\p{L}\d])", "giu");
    private static readonly JsRe ABBREV_END = JsRegex.Compile(@"(?<![\p{L}\p{M}])(dr|prof|şək)\.(?=\s*(?:[.,;:!?»)]|$))", "giu");
    private static readonly JsRe ORDINAL_NCI = JsRegex.Compile(@"(?<![\d.,])(\d+)-(cı|ci|cu|cü)(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe GROUPING = JsRegex.Compile(@"(?<=\d)(?<!(?<![\d\.,])0)[ \u00a0\u202f\u2009](?=\d{3}(?!\d))", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile(@"(?<![\d:,])([01]?\d|2[0-3]):([0-5]\d)(?![\d:]|\.\d)(?:-([a-zəçğıiöşü]{1,5}))?", "giu");
    private static readonly JsRe VERSION_DOT = JsRegex.Compile(@"(?<![\d.,:])(\d+)\.(\d{1,2})(?![\d])(?=\s*(?:[a-zA-Zçğəıiöşüx]|[)»]|$))", "giu");
    private static readonly JsRe VERSION_DOT_UNIT = JsRegex.Compile(@"(?<![\d.,:])(\d+)\.(\d{1,2})(?![\d])(\s?)(?=[a-zA-Zçğəıiöşüx]|GHz?)", "giu");
    private static readonly JsRe RATE_KM = JsRegex.Compile(@"(\d+(?:,\d+)?)\s?km\s?\/\s?(?:saat|h|s)(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe RATE_MIL = JsRegex.Compile(@"(\d+(?:,\d+)?)\s?mil\s?\/\s?(?:saat|h|s)(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe RATE_MS = JsRegex.Compile(@"(\d+(?:,\d+)?)\s?m\s?\/\s?s(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe RATE_YARD = JsRegex.Compile(@"(\d+(?:,\d+)?)\s?yard\s?\/\s?m(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe RATE_MBIT = JsRegex.Compile(@"(\d+(?:,\d+)?)\s?Mbit\s?\/\s?s(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe GHZ = JsRegex.Compile(@"(\d+(?:,\d+)?)\s?Ghz?\b(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe PERCENT_SUFFIXED = JsRegex.Compile(@"(\d+)\s?%-?([a-zəçğıiöşün]{1,5})(?![\p{L}\p{M}])", "gu");
    private static readonly JsRe N_INITIAL = JsRegex.Compile("^n", "u");
    private static readonly JsRe DEG_C = JsRegex.Compile(@"(\d)\s?°\s?C(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile(@"(\d)\s?°\s?F(?![\p{L}\p{M}])", "giu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile(@"(\d)\s?°(?![\p{L}\p{M}])", "gu");
    private static readonly JsRe PLUS = JsRegex.Compile(@"\+\s?(?=\d)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile(@"(?<![\p{L}\p{Nd}])[-−](\d+)(?!\s*[-\d])", "gu");
    private static readonly JsRe AMP_LETTERS = JsRegex.Compile(@"(?<![\p{L}\p{M}])(\p{Lu})&(\p{Lu})(?![\p{L}\p{M}])", "gu");
    private static readonly JsRe AMP_SPACED = JsRegex.Compile(@"\s&\s", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile(@"(\S)\s*=\s*(\S)", "gu");
    private static readonly JsRe LESS = JsRegex.Compile(@"(\d)\s*<\s*(\d)", "gu");
    private static readonly JsRe GREATER = JsRegex.Compile(@"(\d)\s*>\s*(\d)", "gu");
    private static readonly JsRe TIMES = JsRegex.Compile(@"(\d)\s*×\s*(\d)", "gu");
    private static readonly JsRe HALF = JsRegex.Compile(@"(\d+)½", "gu");
    private static readonly JsRe THREE_QUARTERS = JsRegex.Compile(@"(\d+)¾", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile(@"(\d+)\s?÷\s?(\d+)", "gu");
    private static readonly JsRe QUARTER = JsRegex.Compile(@"(\d+)¼", "gu");
    private static readonly JsRe SLASH_FRACTION = JsRegex.Compile(@"(?<![\d/])(\d{1,3})\/(\d{1,3})(?![\d/])", "gu");
    private static readonly JsRe REGNAL_WW = JsRegex.Compile(@"(\d{1,2})\s+Dünya Müharibəsi", "gu");

    /** Normalize one Azerbaijani input string. Pure text→text. */
    public static string NormalizeAzerbaijani(string input)
    {
        var s = input;

        // 1) ERA MARKERS and MULTI-DOT ABBREVIATIONS.
        foreach (var (end, bare, word) in MULTI_DOT_RE)
        {
            s = end.Replace(s, $"{word}.");
            s = bare.Replace(s, word);
        }

        // 2) DOTTED CAPITAL RUNS → a bare all-caps run.
        s = JsRegex.Replace(s, DOTTED_CAPS, m0 => DOTS_AND_SPACE.Replace(m0.Value, ""));
        s = INITIAL_DOT.Replace(s, "");

        // 3) SINGLE-DOT ABBREVIATIONS.
        s = JsRegex.Replace(s, ABBREV_MID, m =>
            $"{DOTTED_ABBREV[Js.ToLowerCase(m.Groups[1].Value)]}{m.Groups[2].Value}");
        s = JsRegex.Replace(s, ABBREV_END, m =>
            $"{DOTTED_ABBREV[Js.ToLowerCase(m.Groups[1].Value)]}.");

        // 4) ORDINALS — the `N-ci` form. BEFORE the clock rule.
        s = JsRegex.Replace(s, ORDINAL_NCI, m => OrdinalWords(Js.Number(m.Groups[1].Value)) ?? m.Value);

        // 5) SPACE-GROUPED THOUSANDS. Two passes, because the groups overlap on the shared digit.
        for (var i = 0; i < 2; i++) s = GROUPING.Replace(s, "");

        // 6) CLOCK, in the COLON form, with the case suffix glued to the last spoken word.
        s = JsRegex.Replace(s, CLOCK, m =>
        {
            double hv = Js.Number(m.Groups[1].Value), mv = Js.Number(m.Groups[2].Value);
            if (hv > 23 || mv > 59) return m.Value;
            var head = mv == 0
                ? AzerbaijaniNumbers.NumberToWords(hv)
                : $"{AzerbaijaniNumbers.NumberToWords(hv)} {AzerbaijaniNumbers.NumberToWords(mv)}";
            var last = head.Split(' ')[^1];
            return $"{head}{(m.Groups[3].Success ? HarmoniseSuffix(last, m.Groups[3].Value) : "")}";
        });

        // 7) VERSION DOTS. AFTER the clock.
        s = VERSION_DOT.Replace(s, "$1 nöqtə $2");
        s = VERSION_DOT_UNIT.Replace(s, "$1 nöqtə $2$3");

        // 8) RATES — prefixed, as the corpus's own prose reads them.
        s = RATE_KM.Replace(s, "saatda $1 kilometr");
        s = RATE_MIL.Replace(s, "saatda $1 mil");
        s = RATE_MS.Replace(s, "saniyədə $1 metr");
        s = RATE_YARD.Replace(s, "metrdə $1 yard");
        s = RATE_MBIT.Replace(s, "saniyədə $1 meqabit");
        s = GHZ.Replace(s, "$1 giqahers");

        // 9) PERCENT with a POSSESSIVE SUFFIX.
        s = JsRegex.Replace(s, PERCENT_SUFFIXED, m =>
        {
            var sfx = m.Groups[2].Value;
            var link = N_INITIAL.IsMatch(sfx) ? HarmoniseSuffix("faiz", "i") : "";
            return $"{m.Groups[1].Value} faiz{link}{HarmoniseSuffix($"faiz{link}", sfx)}";
        });

        // 10) DEGREES.
        s = DEG_C.Replace(s, "$1 dərəcə selsi");
        s = DEG_F.Replace(s, "$1 dərəcə farenheyt");
        s = DEG_BARE.Replace(s, "$1 dərəcə");

        // 11) SIGNS.
        s = PLUS.Replace(s, " üstəgəl ");
        s = MINUS.Replace(s, "mənfi $1");
        s = JsRegex.Replace(s, AMP_LETTERS, m =>
        {
            var a = LETTER_NAME.GetValueOrDefault(G2p.AzLower(m.Groups[1].Value)) ?? m.Groups[1].Value;
            var b = LETTER_NAME.GetValueOrDefault(G2p.AzLower(m.Groups[2].Value)) ?? m.Groups[2].Value;
            return $"{a} və {b}";
        });
        s = AMP_SPACED.Replace(s, " və ");
        s = EQUALS.Replace(s, "$1 bərabərdir $2");
        s = LESS.Replace(s, "$1 kiçikdir $2");
        s = GREATER.Replace(s, "$1 böyükdür $2");
        s = TIMES.Replace(s, "$1 vur $2");

        // 12) FRACTIONS. LAST, so no earlier rule has to work around a slash.
        s = HALF.Replace(s, "$1 yarım");
        s = THREE_QUARTERS.Replace(s, "$1 dörddə üç");
        s = JsRegex.Replace(s, DIVIDE, m =>
        {
            string x = AzerbaijaniNumbers.NumberToWords(Js.Number(m.Groups[1].Value)),
                   y = AzerbaijaniNumbers.NumberToWords(Js.Number(m.Groups[2].Value));
            var cut = y.LastIndexOf(' ') + 1;
            string head = y[..cut], stem = y[cut..];
            return $"{x} {head}{stem}{HarmoniseSuffix(stem, "ə")} bölünür";
        });

        s = QUARTER.Replace(s, "$1 dörddə bir");
        s = JsRegex.Replace(s, SLASH_FRACTION, m =>
        {
            double num = Js.Number(m.Groups[1].Value), den = Js.Number(m.Groups[2].Value);
            if (den == 2) return num == 1 ? "yarım" : $"{AzerbaijaniNumbers.NumberToWords(num)} yarım";
            var dw = AzerbaijaniNumbers.NumberToWords(den);
            return dw == "" ? m.Value : $"{dw}{HarmoniseSuffix(dw, "də")} {AzerbaijaniNumbers.NumberToWords(num)}";
        });

        // 13) REGNAL `II` — the shared Roman pass has already made it a digit.
        s = JsRegex.Replace(s, REGNAL_WW, m =>
        {
            var ord = OrdinalWords(Js.Number(m.Groups[1].Value));
            return ord is null ? m.Value : $"{ord} Dünya Müharibəsi";
        });

        // 14) INITIALISMS, LAST of the letter rules.
        s = NormalizeInitialisms(s);

        return s;
    }
}

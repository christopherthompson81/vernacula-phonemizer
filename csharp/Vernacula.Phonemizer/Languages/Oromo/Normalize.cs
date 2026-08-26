/**
 * Oromo / Afaan Oromoo (om) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is
 * not already a pronounceable word into words the existing pipeline speaks. Pure text→text, no IPA.
 * Ported from src/languages/oromo/normalize.ts — see that file for the corpus evidence, and in particular
 * for why the rules are split across TWO passes with the shared symbol tier running between them.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Oromo;

public static class Normalize
{
    private static string POINT => Manifest.DEF.DecimalWord;

    /** OROMO LETTER NAMES — the Qubee alphabet's own CV names. */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["a"] = "aa", ["b"] = "baa", ["c"] = "caa", ["d"] = "daa", ["e"] = "ee", ["f"] = "faa",
        ["g"] = "gaa", ["h"] = "haa", ["i"] = "ii", ["j"] = "jaa", ["k"] = "kaa", ["l"] = "laa",
        ["m"] = "maa", ["n"] = "na", ["o"] = "oo", ["p"] = "paa", ["q"] = "qaa", ["r"] = "raa",
        ["s"] = "saa", ["t"] = "taa", ["u"] = "uu", ["v"] = "vaa", ["w"] = "waa", ["x"] = "xaa",
        ["y"] = "yaa", ["z"] = "zaa",
    };

    /** Oromo phonotactics for the OOV rule — strongly CV, so the onset test alone spells DNA/FBI/GPS. */
    public static readonly Func<string, bool> IsUnreadableOromo = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[aeiou]", "u"),
        LegalOnsets = new HashSet<string>(new[] { "ch", "dh", "ny", "ph", "sh", "ts" }, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(new[]
        {
            "rk", "rt", "rs", "nt", "nd", "mb", "lt", "st",
            "kn", "ks", "rd", "dn", "rj", "ch", "ft", "ns", "ts", "tt", "ll", "nn",
        }, StringComparer.Ordinal),
        Digraphs = new HashSet<string>(new[] { "ch", "dh", "ny", "sh", "ph", "ts" }, StringComparer.Ordinal),
    });

    private static readonly Func<string, string> INITIALISMS = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => LETTER_NAME.TryGetValue(l, out var v) ? v : null,
        AcronymLetters = new HashSet<string>(Manifest.DEF.AcronymLetters, StringComparer.Ordinal),
        IsRecorded = _ => false,
        IsUnreadable = IsUnreadableOromo,
    });

    public static string NormalizeOromoInitialisms(string text) => INITIALISMS(text);

    /** Measure nouns, in the corpus's own spellings. Emitted BEFORE the number. */
    private static readonly IReadOnlyDictionary<string, string> UNIT = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km"] = "kiiloomeetira",
        ["m"] = "meetira",
        ["mm"] = "miiliimeetira",
        ["cm"] = "seentiimeetira",
        ["kg"] = "kiiloo giraama",
        ["mi"] = "maayilii",
    };
    private static readonly Func<string, string> BARE_UNITS = NormalizeSymbols.MakeBareUnitNormalizer(UNIT);

    /** Rate denominators, already in the LOCATIVE — the corpus's own way of saying "per". */
    private static readonly IReadOnlyDictionary<string, string> PER = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["h"] = "sa’aatiitti", ["s"] = "sekoondiitti",
    };

    /** Compass points for a bearing — all four corpus-attested. */
    private static readonly IReadOnlyDictionary<string, string> COMPASS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["N"] = "kaaba", ["S"] = "kibba", ["E"] = "bahaa", ["W"] = "dhihaa",
    };

    private const string VOWELS = "aeiou";
    private static bool IsVowel(char c) => VOWELS.Contains(c);

    /** The ORDINAL stem — COMPOSED, not tabulated, so it is right at values no corpus writes. */
    private static string OrdinalStem(string word)
    {
        if (word.EndsWith("ii", StringComparison.Ordinal)) return $"{word[..^2]}a";
        return IsVowel(word[^1]) ? word : $"{word}a";
    }

    /** Attach a case enclitic to a numeral word: -n/-f take a LONG link, the rest a SHORT one. */
    private static string AttachEnclitic(string word, string suffix)
    {
        var last = word[^1];
        var lng = suffix == "n" || suffix == "f";
        if (!IsVowel(last)) return $"{word}{(lng ? "ii" : "i")}{suffix}";
        if (!lng) return $"{word}{suffix}";
        return word.Length >= 2 && word[^2] == last ? $"{word}{suffix}" : $"{word}{last}{suffix}";
    }

    /** A number (possibly decimal) → Oromo words, the fraction read digit by digit after `POINT`. */
    private static string NumeralWords(string num)
    {
        var parts = num.Split('.');
        var head = Numbers.NumberToWords(Js.Number(parts[0]), parts[0]);
        if (parts.Length < 2) return head;
        return $"{head} {POINT} {string.Join(" ", Js.CodePoints(parts[1]).Select(d => Numbers.NumberToWords(Js.Number(d))))}";
    }

    /** The written enclitics, longest-first. ONLY the shapes actually glued to digits. */
    private const string ENCLITIC = "ttan|tiin|tti|ti|tu|if|f|n";
    /** The same enclitics WRITTEN WITH A SPACE — a NARROWER alternation, pinning what was counted. */
    private const string ENCLITIC_SPACED = "tiin|tti|ti|f|n";

    // ── Pass 1 patterns ─────────────────────────────────────────────────────────────────────────────
    private static readonly JsRe AMP_ENTITY = JsRegex.Compile("&amp;", "giu");
    private static readonly JsRe AMP = JsRegex.Compile("&", "gu");
    private static readonly JsRe GROUPING = JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0),(?=\\d{3}(?![\\d]))", "gu");
    private static readonly JsRe ERA = JsRegex.Compile("(?<![\\p{L}\\p{M}])D\\.?K\\.?D\\.?(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe FKN = JsRegex.Compile("(?<![\\p{L}\\p{M}])fkn\\.(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe KKF = JsRegex.Compile("(?<![\\p{L}\\p{M}])kkf\\.(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe TITLE = JsRegex.Compile("(?<![\\p{L}\\p{M}])(Dr|Jr|Sr|Mr|Mrs|Prof)\\.(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe INITIAL = JsRegex.Compile("(?<![\\p{L}\\p{M}.])(\\p{Lu})\\.(?=\\s+\\p{Lu})", "gu");
    private static readonly JsRe CLOCK_COLON = JsRegex.Compile(
        "(?<![\\d:.,])([01]?\\d|2[0-3]):([0-5]\\d)(?![:.\\d])(?:\\s*([Aa]\\.?[Mm]\\.?|[Pp]\\.?[Mm]\\.?)(?![\\p{L}\\p{M}]))?", "gu");
    private static readonly JsRe CLOCK_DOT = JsRegex.Compile(
        "(?<![\\d.,])(\\d{1,2})\\.([0-5]\\d)(?![\\d.])(?=\\s*(?:UTC|GMT)(?![\\p{L}\\p{M}]))", "gu");
    private static readonly JsRe MERIDIEM = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}])([Aa]\\.[Mm]|[Pp]\\.[Mm])\\.?(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe VERSION_DOT = JsRegex.Compile(
        "(?<![\\d.,])(\\d+)\\.(\\d+)(?=[a-z](?![\\p{L}\\p{M}]))", "gu");
    private static readonly JsRe RANGE_ORD = JsRegex.Compile(
        "(?<![\\d.,-])(\\d+)ffaa\\s*[-–]\\s*(\\d+)ffaa(?![\\d.,-])", "gu");
    private static readonly JsRe RANGE_YEAR = JsRegex.Compile(
        "(?<![\\d.,-])(\\d{4})\\s?[-–]\\s?(\\d{2,4})(?![\\d.,-])", "gu");
    private static readonly JsRe RANGE_NUM = JsRegex.Compile(
        "(?<![\\d.,-])(\\d+)\\s?[-–]\\s?(\\d+)(?![\\d.,-])", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile(
        "(?<![\\d/.,])(\\d{1,3})\\/(\\d{1,3})(?![\\d/.,])", "gu");
    private static readonly JsRe DEGREE_COMPASS = JsRegex.Compile(
        "(\\d+)\\s?[°º]\\s?([NSEW])(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DEGREE = JsRegex.Compile(
        "(\\d+)\\s?[°º]\\s?[CF]?(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe MULTIPLY = JsRegex.Compile("(\\d+)\\s*(?:×|x)\\s*(\\d+)", "gu");

    /** ⚠ LENGTH-DESCENDING, STABLE — `Array.prototype.sort` is stable and so is LINQ's OrderByDescending. */
    private static readonly string UNITS_ALT = string.Join("|", UNIT.Keys.OrderByDescending(k => k.Length));
    private static readonly JsRe RATE = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}\\d])(\\d[\\d.]*)\\s?({UNITS_ALT})\\s?/\\s?([hs])(?![\\p{{L}}\\p{{M}}])", "giu");
    private static readonly JsRe SQ_MI = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}\\d])(\\d[\\d.]*)\\s?sq\\s?mi(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe SQUARED = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}\\d])(\\d[\\d.]*)\\s?({UNITS_ALT})(?:\\s?²|2)(?![\\p{{L}}\\p{{M}}\\d])", "giu");
    private static readonly JsRe CUBED = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}\\d])(\\d[\\d.]*)\\s?({UNITS_ALT})(?:\\s?³|3)(?![\\p{{L}}\\p{{M}}\\d])", "giu");
    private static readonly JsRe SQUARED_FIRST = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}\\d])({UNITS_ALT})(?:\\s?²|2)\\s?(?=\\d)", "giu");
    private static readonly JsRe CUBED_FIRST = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}\\d])({UNITS_ALT})(?:\\s?³|3)\\s?(?=\\d)", "giu");
    private static readonly JsRe UNIT_BEFORE = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}\\d])({UNITS_ALT})\\s?(?=\\d)", "giu");
    private static readonly JsRe UNIT_AFTER = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}\\d])(\\d[\\d.]*)\\s?({UNITS_ALT})(?![\\p{{L}}\\p{{M}}’'ʼ])", "giu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("(\\d+)\\s*<\\s*(\\d+)", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("(\\d+)\\s*>\\s*(\\d+)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s*=\\s*", "gu");
    private static readonly JsRe PLUS = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d])\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d])(?<!\\d\\s{0,2})[-−]\\s?(?=\\d)", "gu");

    /** Normalize one Oromo input string, BEFORE the shared symbol tier. Steps are ORDER-DEPENDENT. */
    public static string NormalizeOromo(string input)
    {
        var s = input;

        s = AMP_ENTITY.Replace(s, " fi ");
        s = AMP.Replace(s, " fi ");
        s = GROUPING.Replace(s, "");
        s = ERA.Replace(s, "dhaloota Kiristoos dura");
        s = FKN.Replace(s, "fakkeenyaaf");
        s = KKF.Replace(s, "kan kana fakkaatan");
        s = TITLE.Replace(s, "$1");
        s = INITIAL.Replace(s, "$1");

        s = CLOCK_COLON.Replace(s, m =>
        {
            var h = m.Groups[1].Value;
            var min = m.Groups[2].Value;
            var ap = m.Groups[3].Success ? m.Groups[3].Value : null;
            var head = Js.Number(min) == 0
                ? Js.NumberToString(Js.Number(h))
                : $"{Js.NumberToString(Js.Number(h))} fi daqiiqaa {Js.NumberToString(Js.Number(min))}";
            var half = ap is null ? "" : Js.ToLowerCase(ap).StartsWith("p", StringComparison.Ordinal) ? " galgala" : " ganama";
            return $"{head}{half}";
        });

        s = CLOCK_DOT.Replace(s, m =>
        {
            var h = m.Groups[1].Value;
            var min = m.Groups[2].Value;
            return Js.Number(min) == 0
                ? Js.NumberToString(Js.Number(h))
                : $"{Js.NumberToString(Js.Number(h))} fi daqiiqaa {Js.NumberToString(Js.Number(min))}";
        });

        s = MERIDIEM.Replace(s, m =>
            Js.ToLowerCase(m.Value).StartsWith("p", StringComparison.Ordinal) ? "galgala" : "ganama");

        s = VERSION_DOT.Replace(s, m =>
            $"{m.Groups[1].Value} {POINT} {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}-");

        s = RANGE_ORD.Replace(s, "$1ffaa hanga $2ffaa");
        s = RANGE_YEAR.Replace(s, "$1 hanga $2");
        s = RANGE_NUM.Replace(s, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            return Js.Number(b) > Js.Number(a) ? $"{a} hanga {b}" : m.Value;
        });

        s = FRACTION.Replace(s, "$2 keessaa $1");

        s = DEGREE_COMPASS.Replace(s, m => $"digirii {m.Groups[1].Value} {COMPASS[m.Groups[2].Value]}");
        s = DEGREE.Replace(s, "digirii $1");

        // ⚠ THE MULTIPLICATION SIGN RUNS BEFORE THE UNIT BLOCK — the unit rules MOVE the noun ahead of its
        // number, which would strand the sign's second operand. See the TS note for both failure shapes.
        s = MULTIPLY.Replace(s, "$1 si’a $2");

        s = RATE.Replace(s, m =>
            $"{PER[Js.ToLowerCase(m.Groups[3].Value)]} {UNIT[Js.ToLowerCase(m.Groups[2].Value)]} {m.Groups[1].Value}");
        s = SQ_MI.Replace(s, "iskuweer maayilii $1");
        s = SQUARED.Replace(s, m => $"iskuweer {UNIT[Js.ToLowerCase(m.Groups[2].Value)]} {m.Groups[1].Value}");
        s = CUBED.Replace(s, m => $"kubiik {UNIT[Js.ToLowerCase(m.Groups[2].Value)]} {m.Groups[1].Value}");
        // ⚠ BEFORE UNIT_BEFORE, which would otherwise claim the abbreviation and orphan the power.
        s = SQUARED_FIRST.Replace(s, m => $"iskuweer {UNIT[Js.ToLowerCase(m.Groups[1].Value)]} ");
        s = CUBED_FIRST.Replace(s, m => $"kubiik {UNIT[Js.ToLowerCase(m.Groups[1].Value)]} ");
        s = UNIT_BEFORE.Replace(s, m => $"{UNIT[Js.ToLowerCase(m.Groups[1].Value)]} ");
        s = UNIT_AFTER.Replace(s, m => $"{UNIT[Js.ToLowerCase(m.Groups[2].Value)]} {m.Groups[1].Value}");
        s = BARE_UNITS(s);

        s = LESS_THAN.Replace(s, "$1 $2 caalaa xiqqaa");
        s = GREATER_THAN.Replace(s, "$1 $2 caalaa guddaa");
        s = EQUALS.Replace(s, " wal qixa ");
        s = PLUS.Replace(s, "ida’uu ");
        s = MINUS.Replace(s, "hir’isuu ");

        return Tidy(s);
    }

    // ── Pass 2 patterns ─────────────────────────────────────────────────────────────────────────────
    private static readonly JsRe GLUED = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}\\d])(\\d+(?:\\.\\d+)?)[’'ʼ]?(ffaa[’'ʼ]?[a-z]{{0,8}}|{ENCLITIC})(?![\\p{{L}}\\p{{M}}\\d])", "gu");
    private static readonly JsRe SPACED = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}\\d])(\\d+(?:\\.\\d+)?)[’'ʼ]? ({ENCLITIC_SPACED})(?![\\p{{L}}\\p{{M}}\\d])", "gu");
    private static readonly JsRe HALFDAY_ENCLITIC = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}])(ganama|galgala) ({ENCLITIC_SPACED})(?![\\p{{L}}\\p{{M}}\\d])", "gu");
    private static readonly JsRe APOSTROPHES = JsRegex.Compile("[’'ʼ]", "gu");
    private static readonly JsRe DECIMAL = JsRegex.Compile("(?<![\\d.,])(\\d+)[.,](\\d+)(?!\\d)", "gu");

    /** The number rules that cannot leave digits behind, run AFTER the shared symbol tier. */
    public static string NormalizeOromoNumerals(string input)
    {
        var s = input;

        s = GLUED.Replace(s, m =>
        {
            var words = NumeralWords(m.Groups[1].Value).Split(' ').ToList();
            var suf = m.Groups[2].Value;
            if (words.Count == 0) return m.Value;
            var last = words[^1];
            words.RemoveAt(words.Count - 1);
            if (suf.StartsWith("ffaa", StringComparison.Ordinal))
            {
                var trailer = APOSTROPHES.Replace(suf[4..], "");
                words.Add($"{OrdinalStem(last)}ffaa{trailer}");
                return string.Join(" ", words);
            }
            words.Add(AttachEnclitic(last, suf == "if" ? "f" : suf));
            return string.Join(" ", words);
        });

        s = SPACED.Replace(s, m =>
        {
            var words = NumeralWords(m.Groups[1].Value).Split(' ').ToList();
            if (words.Count == 0) return m.Value;
            var last = words[^1];
            words.RemoveAt(words.Count - 1);
            words.Add(AttachEnclitic(last, m.Groups[2].Value));
            return string.Join(" ", words);
        });

        s = HALFDAY_ENCLITIC.Replace(s, m => AttachEnclitic(m.Groups[1].Value, m.Groups[2].Value));

        s = DECIMAL.Replace(s, m =>
            $"{m.Groups[1].Value} {POINT} {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        return Tidy(s);
    }

    private static readonly JsRe RUNS = JsRegex.Compile("[^\\S\\n]{2,}", "gu");
    private static readonly JsRe EDGES = JsRegex.Compile("^[^\\S\\n]+|[^\\S\\n]+$", "gu");

    private static string Tidy(string s) => EDGES.Replace(RUNS.Replace(s, " "), "");
}

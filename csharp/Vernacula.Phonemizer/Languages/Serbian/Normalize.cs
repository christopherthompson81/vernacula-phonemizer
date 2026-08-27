/**
 * Serbian (sr) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; every rule accepts BOTH scripts.
 * `IsUnreadableSerbian` and `NormalizeSerbianInitialisms` are shared with hr/bs.
 * Ported from src/languages/serbian/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Serbian;

public static class Normalize
{
    private static SerbianNumbers N => Manifest.MANIFEST.Numbers;

    // -----------------------------------------------------------------------------------------------
    // SCRIPT
    // -----------------------------------------------------------------------------------------------

    /** Serbian Cyrillic → Gaj's Latin, a strict bijection. */
    private static readonly IReadOnlyDictionary<string, string> CYR2LAT = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["а"] = "a", ["б"] = "b", ["в"] = "v", ["г"] = "g", ["д"] = "d", ["ђ"] = "đ", ["е"] = "e", ["ж"] = "ž",
        ["з"] = "z", ["и"] = "i", ["ј"] = "j", ["к"] = "k", ["л"] = "l", ["љ"] = "lj", ["м"] = "m", ["н"] = "n",
        ["њ"] = "nj", ["о"] = "o", ["п"] = "p", ["р"] = "r", ["с"] = "s", ["т"] = "t", ["ћ"] = "ć", ["у"] = "u",
        ["ф"] = "f", ["х"] = "h", ["ц"] = "c", ["ч"] = "č", ["џ"] = "dž", ["ш"] = "š",
    };

    /** Lowercase and transliterate to Latin, so one key set serves both scripts. */
    private static string Lat(string word)
    {
        var outp = new System.Text.StringBuilder();
        foreach (var ch in Js.CodePoints(Js.ToLowerCase(word)))
            outp.Append(CYR2LAT.TryGetValue(ch, out var l) ? l : ch);
        return outp.ToString();
    }

    // -----------------------------------------------------------------------------------------------
    // ORDINALS
    // -----------------------------------------------------------------------------------------------

    private static readonly string[] ORD_1_19 =
    {
        "", "prvi", "drugi", "treći", "četvrti", "peti", "šesti", "sedmi", "osmi", "deveti",
        "deseti", "jedanaesti", "dvanaesti", "trinaesti", "četrnaesti", "petnaesti", "šesnaesti",
        "sedamnaesti", "osamnaesti", "devetnaesti",
    };
    private static readonly string[] ORD_TENS =
    {
        "", "deseti", "dvadeseti", "trideseti", "četrdeseti", "pedeseti", "šezdeseti", "sedamdeseti",
        "osamdeseti", "devedeseti",
    };
    private static readonly string[] ORD_HUNDREDS =
    {
        "", "stoti", "dvestoti", "tristoti", "četiristoti", "petstoti", "šeststoti", "sedamstoti",
        "osamstoti", "devetstoti",
    };

    /** Integer → the masculine-nominative ordinal; null for a round thousand other than 1000. */
    private static string? OrdinalBase(double n)
    {
        if (!double.IsInteger(n) || n < 1 || n >= 1_000_000) return null;
        if (n < 20) return ORD_1_19[(int)n];
        if (n < 100)
        {
            double t = Math.Floor(n / 10), u = n % 10;
            return u == 0 ? ORD_TENS[(int)t] : $"{N.Tens[(int)t]} {ORD_1_19[(int)u]}";
        }
        if (n < 1000)
        {
            var r100 = n % 100;
            return r100 == 0 ? ORD_HUNDREDS[(int)(n / 100)] : $"{Numbers.NumberToWords(n - r100)} {OrdinalBase(r100)}";
        }
        if (n == 1000) return "hiljaditi";
        var r = n % 1000;
        if (r == 0) return null; // dvehiljaditi & co. — not attempted
        return $"{Numbers.NumberToWords(n - r)} {OrdinalBase(r)}";
    }

    /** Definite-adjective endings, [HARD stem, SOFT stem]. ⚠ INSERTION-ORDERED: `OrdinalForms` returns them
     *  in this order and step 5 keeps the FIRST whose tail matches the written suffix. */
    private static readonly (string Slot, string Hard, string Soft)[] ENDINGS =
    {
        ("m.nom", "i", "i"), ("m.gen", "og", "eg"), ("m.loc", "om", "em"), ("n.nom", "o", "e"),
        ("f.nom", "a", "a"), ("f.gen", "e", "e"), ("f.dat", "oj", "oj"), ("f.acc", "u", "u"),
        ("pl.gen", "ih", "ih"),
    };

    /** Inflect a citation-form ordinal into one slot. Only the final word carries the ending. */
    private static string? Inflect(string bas, string slot)
    {
        var idx = Array.FindIndex(ENDINGS, e => e.Slot == slot);
        if (idx < 0) return null;
        var words = bas.Split(' ');
        var last = words[^1];
        var soft = last.EndsWith("ći", StringComparison.Ordinal); // treći
        words[^1] = last[..^1] + (soft ? ENDINGS[idx].Soft : ENDINGS[idx].Hard);
        return string.Join(" ", words);
    }

    /** Every slot's form for `n`, for the suffix-matching rule (step 5). */
    private static List<string> OrdinalForms(double n)
    {
        var bas = OrdinalBase(n);
        if (bas is null) return new List<string>();
        return ENDINGS.Select(e => Inflect(bas, e.Slot)!).ToList();
    }

    /** The closed list of LICENSING words that make a bare `N.` an ordinal, each → the case slot it governs. */
    private static readonly IReadOnlyDictionary<string, string> LICENSOR = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["godine"] = "f.gen", ["godini"] = "f.dat", ["godinu"] = "f.acc", ["godina"] = "f.nom",
        ["veka"] = "m.gen", ["veku"] = "m.loc", ["vek"] = "m.nom", ["vijeka"] = "m.gen", ["vijeku"] = "m.loc",
        ["januara"] = "m.gen", ["februara"] = "m.gen", ["marta"] = "m.gen", ["aprila"] = "m.gen", ["maja"] = "m.gen",
        ["juna"] = "m.gen", ["jula"] = "m.gen", ["avgusta"] = "m.gen", ["septembra"] = "m.gen", ["oktobra"] = "m.gen",
        ["novembra"] = "m.gen", ["decembra"] = "m.gen",
    };

    // -----------------------------------------------------------------------------------------------
    // COUNTED NOUNS
    // -----------------------------------------------------------------------------------------------

    /** Pick a three-form Slavic count noun for `n`: [nom.sg, gen.sg (2–4), gen.pl]. */
    private static string Counted(double n, string[] forms) =>
        forms[Math.Min(NormalizeSymbols.SlavicCountForm(n), 2)];

    private static readonly string[] SAT = { "sat", "sata", "sati" };
    private static readonly string[] MINUT = { "minut", "minuta", "minuta" };
    private static readonly string[] STEPEN = { "stepen", "stepena", "stepeni" };
    private static readonly string[] METAR = { "metar", "metra", "metara" };
    private static readonly string[] MEGABIT = { "megabit", "megabita", "megabita" };

    /** Dotted abbreviations whose dot is NOT a sentence end. */
    private static readonly IReadOnlyDictionary<string, string> DOTTED = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["itd"] = "i tako dalje",
        ["npr"] = "na primer",
        ["tzv"] = "takozvani",
    };

    /** Latin → Serbian Cyrillic, the inverse of CYR2LAT restricted to the single-character values. */
    private static readonly IReadOnlyDictionary<string, string> LAT2CYR =
        CYR2LAT.Where(kv => kv.Value.Length == 1).ToDictionary(kv => kv.Value, kv => kv.Key, StringComparer.Ordinal);

    private static string Cyr(string word)
    {
        var outp = new System.Text.StringBuilder();
        foreach (var ch in Js.CodePoints(word)) outp.Append(LAT2CYR.TryGetValue(ch, out var c) ? c : ch);
        return outp.ToString();
    }

    /** ⚠ BOTH SCRIPTS in the alternation, or the rule is a no-op on Cyrillic prose. */
    private static readonly string DOTTED_ALT = string.Join("|",
        DOTTED.Keys.SelectMany(k => new[] { k, Cyr(k) }).OrderByDescending(a => a.Length));

    /** The shared symbol tier. Unit abbreviations are written in LATIN even in Cyrillic prose, so the keys
     *  are Latin only. `/s` is composed locally in step 6 — its Serbian rate is "u sekundi", not "na …". */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Ampersand = "и",
        Multiply = new MultiplyDef { Times = "puta" },
        Percent = new[] { "posto" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "dolar", "dolara", "dolara" },
            ["¥"] = new[] { "jen", "jena", "jena" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilometar", "kilometra", "kilometara" },
            ["m"] = new[] { "metar", "metra", "metara" },
            ["mm"] = new[] { "milimetar", "milimetra", "milimetara" },
            ["cm"] = new[] { "centimetar", "centimetra", "centimetara" },
            ["mi"] = new[] { "milja", "milje", "milja" },
            ["ghz"] = new[] { "gigaherc", "gigaherca", "gigaherca" },
        },
        UnitPer = "na",
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal) { ["h"] = "sat" },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "kvadratni", "kvadratna", "kvadratnih" },
            Cubed = new[] { "kubni", "kubna", "kubnih" },
            Position = "before",
        },
        CountForm = NormalizeSymbols.SlavicCountForm,
    });

    // -----------------------------------------------------------------------------------------------
    // The rules
    // -----------------------------------------------------------------------------------------------

    private static readonly JsRe DEGROUP = JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0)\\.(?=\\d{3}(?!\\d))", "gu");
    private static readonly JsRe ERA_YEAR =
        JsRegex.Compile("(?<![\\d.,])(\\d{1,4})\\.\\s+(?=(?:п\\.\\s?н\\.\\s?е|p\\.\\s?n\\.\\s?e)(?![\\p{L}\\p{M}]))", "giu");

    private static readonly (string Pat, string Words)[] ERAS =
    {
        ("п\\.\\s?н\\.\\s?е", "pre nove ere"), ("p\\.\\s?n\\.\\s?e", "pre nove ere"),
        ("н\\.\\s?е", "nove ere"), ("n\\.\\s?e", "nove ere"),
    };
    private static readonly (JsRe Dotted, JsRe Bare, string Words)[] ERA_RES = ERAS.Select(e =>
        (JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}]){e.Pat}\\.(\\s*)(\\S?)", "giu"),
         JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}]){e.Pat}(?![\\p{{L}}\\p{{M}}.])", "giu"),
         e.Words)).ToArray();

    private static readonly JsRe CLOCK_DOT =
        JsRegex.Compile("(?<![\\d.,])(\\d{1,2})\\.(\\d{2})(?=\\s*(?:сати|часова|sati|časova))", "gu");
    private static readonly JsRe ABBREV_MID =
        JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({DOTTED_ALT})\\.(\\s+)(?=[\\p{{L}}\\d(])", "giu");
    private static readonly JsRe ABBREV_COMMA =
        JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({DOTTED_ALT})\\.(?=\\s*[,;:])", "giu");
    private static readonly JsRe ABBREV_END =
        JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({DOTTED_ALT})\\.(?=\\s*(?:[.!?”\"»)\\]]|$))", "giu");
    private static readonly JsRe MINUS = JsRegex.Compile("(?<![\\p{L}\\p{M}\\p{Nd}])[-−–](?=\\d)", "gu");
    private static readonly JsRe DIGIT_LEFT = JsRegex.Compile("\\d\\s*$", "u");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS_AFTER = JsRegex.Compile("(\\S)\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe PLUS_START = JsRegex.Compile("(^|\\s)\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("\\s?<\\s?", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("\\s?>\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe DEG_SCALE =
        JsRegex.Compile("(\\d+)\\s?°(?:\\s?([CFcf])|([СЦФсцф]))(?![\\p{L}\\p{M}])(\\s*(?:степен[аи]|stepen[ai]))?", "gui");
    private static readonly JsRe FAHRENHEIT = JsRegex.Compile("[FfФф]", "u");
    private static readonly JsRe DEG_BARE =
        JsRegex.Compile("(\\d+)\\s?°(?:(?:\\s?[NEWJZSIXYQnewjzxyqЈЗСИјз]|[siси])(?![\\p{L}\\p{M}]))?(\\s*(?:степен[аи]|stepen[ai]))?", "gu");
    private static readonly JsRe SUFFIXED =
        JsRegex.Compile($"(?<![\\d.,])(\\d+)\\s?-\\s?(\\p{{Ll}}{{1,2}}){Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe MBIT_S = JsRegex.Compile("(\\d+(?:[.,]\\d+)?)\\s?Mbit\\s?\\/\\s?s(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe M_S = JsRegex.Compile("(\\d+(?:[.,]\\d+)?)\\s?m\\s?\\/\\s?s(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile("(\\d)\\s?[-–—]\\s?(?=\\d)", "gu");
    private static readonly JsRe ORDINAL_N = JsRegex.Compile("(?<![\\d.,])(\\d{1,4})\\.\\s+(\\p{Ll}[\\p{L}\\p{M}]*)", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(?<![\\d:.,])([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:.,])", "gu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(?<=\\d),(?=\\d)", "gu");
    private static readonly JsRe TIMES = JsRegex.Compile("(?<=\\d)\\s?[x×]\\s?(?=\\d)", "gu");
    private static readonly JsRe PLUS_SIGN = JsRegex.Compile("(^|[\\s(])\\+\\s?(\\d)", "gu");
    private static readonly JsRe GROUP_DOT = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe ERA_PUNCT = JsRegex.Compile("[,;:!?)»”\"]", "u");
    private static readonly JsRe ERA_UPPER = JsRegex.Compile("\\p{Lu}", "u");

    /** Normalize one Serbian input string. Pure text→text. */
    public static string NormalizeSerbian(string input)
    {
        var s = input;

        // 0) DIGIT DE-GROUPING, FIRST. Two passes, because adjacent groups share a digit (`800.000`).
        for (var i = 0; i < 2; i++) s = DEGROUP.Replace(s, "");

        // 1) MULTI-DOT ERA MARKER, before the abbreviation and `N.` ordinal rules.
        s = ERA_YEAR.Replace(s, m =>
        {
            var bas = OrdinalBase(Js.Number(m.Groups[1].Value));
            return bas is null ? m.Value : $"{Inflect(bas, "f.gen")} ";
        });
        foreach (var (dotted, bare, words) in ERA_RES)
        {
            s = dotted.Replace(s, m => ReplaceEra(words, m.Groups[1].Value, m.Groups[2].Value));
            s = bare.Replace(s, _ => words);
        }

        // 2) DOT-WRITTEN CLOCK — `12.00 сати`.
        s = CLOCK_DOT.Replace(s, m =>
        {
            var h = m.Groups[1].Value;
            var min = Js.Number(m.Groups[2].Value);
            return min == 0 ? h : $"{h} i {Js.NumberToString(min)}";
        });

        // 3) DOTTED ABBREVIATIONS.
        s = ABBREV_MID.Replace(s, m => $"{DOTTED[Lat(m.Groups[1].Value)]}{m.Groups[2].Value}");
        s = ABBREV_COMMA.Replace(s, m => DOTTED[Lat(m.Groups[1].Value)]);
        s = ABBREV_END.Replace(s, m => $"{DOTTED[Lat(m.Groups[1].Value)]}.");

        // 3b) SIGNS. ⚠ `±` MUST PRECEDE THE `+` ARMS.
        var subject = s;
        s = MINUS.Replace(s, m => DIGIT_LEFT.IsMatch(subject[..m.Index]) ? m.Value : "минус ");
        s = PLUS_MINUS.Replace(s, " плус минус ");
        s = PLUS_AFTER.Replace(s, "$1 плус ");
        s = PLUS_START.Replace(s, "$1плус ");

        // 3c) RELATIONAL AND DIVISION SIGNS.
        s = EQUALS.Replace(s, " једнако ");
        s = LESS_THAN.Replace(s, " мање од ");
        s = GREATER_THAN.Replace(s, " веће од ");
        s = DIVIDE.Replace(s, " подељено са ");

        // 4) DEGREES, two arms — the scale-bearing one first, then the bare degree.
        s = DEG_SCALE.Replace(s, m =>
        {
            var n = m.Groups[1].Value;
            var scale = m.Groups[2].Success ? m.Groups[2].Value : m.Groups[3].Success ? m.Groups[3].Value : "";
            return $"{n} {Counted(Js.Number(n), STEPEN)} " + (FAHRENHEIT.IsMatch(scale) ? "Farenhajta" : "Celzijusa");
        });
        // ⚠ TRAILING SPACE — any letter this arm does not consume would otherwise glue onto the noun.
        s = DEG_BARE.Replace(s, m => $"{m.Groups[1].Value} {Counted(Js.Number(m.Groups[1].Value), STEPEN)} ");

        // 5) NUMERAL + HYPHEN + CASE SUFFIX (`1970-их`, `15-ог`). Before the range rule (6b).
        s = SUFFIXED.Replace(s, m =>
        {
            var suffix = Lat(m.Groups[2].Value);
            return OrdinalForms(Js.Number(m.Groups[1].Value)).FirstOrDefault(f => f.EndsWith(suffix, StringComparison.Ordinal))
                ?? m.Value;
        });

        // 6) UNITS THE SHARED TIER CANNOT EXPRESS — the `/s` rate takes "u sekundi".
        s = MBIT_S.Replace(s, m => $"{m.Groups[1].Value} {Counted(IntOf(m.Groups[1].Value), MEGABIT)} u sekundi");
        s = M_S.Replace(s, m => $"{m.Groups[1].Value} {Counted(IntOf(m.Groups[1].Value), METAR)} u sekundi");

        // 6b) NUMERIC RANGES.
        s = RANGE.Replace(s, "$1 do ");

        // 7) THE `N.` ORDINAL — only before a LOWERCASE licensing word.
        s = ORDINAL_N.Replace(s, m =>
        {
            var word = m.Groups[2].Value;
            if (!LICENSOR.TryGetValue(Lat(word), out var slot)) return m.Value;
            var bas = OrdinalBase(Js.Number(m.Groups[1].Value));
            if (bas is null) return m.Value; // round thousands — see OrdinalBase
            return $"{Inflect(bas, slot)} {word}";
        });

        // 8) CLOCK — a CARDINAL hour with the counted noun.
        s = CLOCK.Replace(s, m =>
        {
            double hv = Js.Number(m.Groups[1].Value), mv = Js.Number(m.Groups[2].Value);
            var head = $"{Numbers.NumberToWords(hv)} {Counted(hv, SAT)}";
            return mv == 0 ? head : $"{head} i {Numbers.NumberToWords(mv)} {Counted(mv, MINUT)}";
        });

        // 9) THE SHARED SYMBOL TIER — it must see the number still adjacent to its unit and still carrying
        //    its decimal comma, so it runs before step 10.
        s = SYMBOLS(s);

        // 10) DECIMAL COMMA → *zarez*. LAST among the numeric rules, because it destroys the number.
        s = DECIMAL_COMMA.Replace(s, " zarez ");

        // 11) `×`/`x` between digits, and the leading `+`.
        s = TIMES.Replace(s, " puta ");
        s = PLUS_SIGN.Replace(s, "$1plus $2");

        // 12) INITIALISMS, LAST.
        return NormalizeSerbianInitialisms(s);
    }

    /** Integer part of a Serbian-written number ("3,50" → 3), for the local count-agreement calls. */
    private static double IntOf(string n) =>
        Math.Truncate(Js.Number(Js.ReplaceFirst(GROUP_DOT.Replace(n, ""), ",", ".")));

    /** The era-marker replacer (step 1). Keeps the final dot only when it was ALSO the sentence end. */
    private static string ReplaceEra(string words, string sp, string next)
    {
        if (next.Length == 0) return $"{words}.";
        if (ERA_PUNCT.IsMatch(next)) return $"{words}{sp}{next}";
        if (ERA_UPPER.IsMatch(next)) return $"{words}.{sp}{next}";
        return $"{words}{sp}{next}";
    }

    // -----------------------------------------------------------------------------------------------
    // INITIALISMS
    // -----------------------------------------------------------------------------------------------

    /** Serbo-Croatian letter names, both scripts. A stop or ⟨v z⟩ takes a following -e; a continuant takes
     *  a preceding e-; a vowel is itself. */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["a"] = "a", ["b"] = "be", ["c"] = "ce", ["č"] = "če", ["ć"] = "će", ["d"] = "de", ["đ"] = "đe",
        ["e"] = "e", ["f"] = "ef", ["g"] = "ge", ["h"] = "ha", ["i"] = "i", ["j"] = "je", ["k"] = "ka",
        ["l"] = "el", ["m"] = "em", ["n"] = "en", ["o"] = "o", ["p"] = "pe", ["r"] = "er", ["s"] = "es",
        ["š"] = "eš", ["t"] = "te", ["u"] = "u", ["v"] = "ve", ["z"] = "ze", ["ž"] = "že",
        ["q"] = "ku", ["w"] = "dublve", ["x"] = "iks", ["y"] = "ipsilon",
        ["а"] = "a", ["б"] = "be", ["ц"] = "ce", ["ч"] = "če", ["ћ"] = "će", ["д"] = "de", ["ђ"] = "đe",
        ["е"] = "e", ["ф"] = "ef", ["г"] = "ge", ["х"] = "ha", ["и"] = "i", ["ј"] = "je", ["к"] = "ka",
        ["л"] = "el", ["м"] = "em", ["н"] = "en", ["о"] = "o", ["п"] = "pe", ["р"] = "er", ["с"] = "es",
        ["ш"] = "eš", ["т"] = "te", ["у"] = "u", ["в"] = "ve", ["з"] = "ze", ["ж"] = "že",
    };

    /** Serbo-Croatian phonotactics for the OOV test — generous on purpose; the work is done by the
     *  NO-VOWEL test and the coda test. Shared with hr/bs. */
    public static readonly Func<string, bool> IsUnreadableSerbian = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[aeiouаеиоу]", "u"),
        LegalOnsets = new HashSet<string>(new[]
        {
            "bl", "br", "cr", "cv", "čl", "čr", "čv", "dj", "dr", "dv", "fl", "fr", "gl", "gn", "gr",
            "hl", "hr", "hv", "jd", "kl", "kn", "kr", "kt", "kv", "ml", "mn", "mr", "pč", "pl", "pn",
            "pr", "ps", "pš", "pt", "sf", "sk", "sl", "sm", "sn", "sp", "sr", "st", "sv", "šć", "šk",
            "šl", "šm", "šn", "šp", "št", "šv", "tk", "tl", "tr", "tv", "vl", "vr", "zb", "zd", "zg",
            "zl", "zm", "zn", "zv", "žd", "žl", "žm", "žv",
        }, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(new[]
        {
            "jd", "jn", "jt", "kt", "lj", "ls", "lt", "mp", "nc", "nd", "ng", "nj", "nk", "ns", "nt",
            "rc", "rd", "rf", "rk", "rn", "rs", "rt", "rv", "rz", "sk", "sl", "sm", "sn", "sp", "st",
            "šć", "št", "zd", "zm", "zn",
        }, StringComparer.Ordinal),
        Digraphs = new HashSet<string>(new[] { "dž", "lj", "nj" }, StringComparer.Ordinal),
    });

    private static readonly Func<string, string> InitialismNormalizer = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => LETTER_NAME.TryGetValue(l, out var v) ? v : null,
        AcronymLetters = new HashSet<string>(Manifest.MANIFEST.AcronymLetters, StringComparer.Ordinal),
        IsRecorded = _ => false,
        IsUnreadable = w => IsUnreadableSerbian(w),
    });

    /** Spell an all-caps letter run. ⚠ RUNS LAST in `NormalizeSerbian`. Shared with hr/bs. */
    public static string NormalizeSerbianInitialisms(string text) => InitialismNormalizer(text);
}

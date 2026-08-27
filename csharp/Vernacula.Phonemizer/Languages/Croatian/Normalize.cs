/**
 * Croatian (hr) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA. Shares serbian/normalize.ts's
 * shape with Croatian data, and ends on the SHARED initialism pass.
 * Ported from src/languages/croatian/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;
using SR = Vernacula.Phonemizer.Languages.Serbian;

namespace Vernacula.Phonemizer.Languages.Croatian;

public static class Normalize
{
    private static SR.SerbianNumbers N => Manifest.MANIFEST.Numbers;

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
        "", "stoti", "dvjestoti", "tristoti", "četiristoti", "petstoti", "šeststoti", "sedamstoti",
        "osamstoti", "devetstoti",
    };

    /** Integer → the masculine-nominative ordinal; only the LAST element inflects. */
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
        if (n == 1000) return "tisućiti";
        var r = n % 1000;
        if (r == 0) return null;
        return $"{Numbers.NumberToWords(n - r)} {OrdinalBase(r)}";
    }

    /** Definite-adjective endings, [HARD stem, SOFT stem]. ⚠ INSERTION-ORDERED: `OrdinalForms` returns them
     *  in this order and step 6 keeps the FIRST whose tail matches the written suffix. */
    private static readonly (string Slot, string Hard, string Soft)[] ENDINGS =
    {
        ("m.nom", "i", "i"), ("m.gen", "og", "eg"), ("m.loc", "om", "em"), ("n.nom", "o", "e"),
        ("n.gen", "og", "eg"), ("n.loc", "om", "em"),
        ("f.nom", "a", "a"), ("f.gen", "e", "e"), ("f.dat", "oj", "oj"), ("f.acc", "u", "u"),
        ("pl.gen", "ih", "ih"),
    };

    private static string? Inflect(string bas, string slot)
    {
        var idx = Array.FindIndex(ENDINGS, e => e.Slot == slot);
        if (idx < 0) return null;
        var words = bas.Split(' ');
        var last = words[^1];
        var soft = last.EndsWith("ći", StringComparison.Ordinal); // treći is the only soft stem
        words[^1] = last[..^1] + (soft ? ENDINGS[idx].Soft : ENDINGS[idx].Hard);
        return string.Join(" ", words);
    }

    private static List<string> OrdinalForms(double n)
    {
        var bas = OrdinalBase(n);
        if (bas is null) return new List<string>();
        return ENDINGS.Select(e => Inflect(bas, e.Slot)!).ToList();
    }

    /** The closed list of licensing words that make a bare `N.` an ordinal, each → the case slot it governs. */
    private static readonly IReadOnlyDictionary<string, string> LICENSOR = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["godine"] = "f.gen", ["godini"] = "f.dat", ["godinu"] = "f.acc", ["godina"] = "f.nom",
        ["stoljeća"] = "n.gen", ["stoljeću"] = "m.loc", ["stoljeće"] = "m.nom", ["vijeka"] = "m.gen", ["vijeku"] = "m.loc",
        ["marka"] = "f.gen", ["marku"] = "f.acc", ["najvećim"] = "m.loc",
        ["mjesto"] = "n.nom", ["mjestu"] = "n.loc", ["najveća"] = "f.nom", ["najveći"] = "m.nom", ["najveće"] = "n.nom",
        ["kategorije"] = "f.gen", ["pakistanskog"] = "m.gen", ["pukovnija"] = "f.nom", ["husarska"] = "f.nom",
        ["kolovoza"] = "m.gen", ["rujna"] = "m.gen", ["listopada"] = "m.gen", ["srpnja"] = "m.gen", ["travnja"] = "m.gen",
        ["svibnja"] = "m.gen", ["lipnja"] = "m.gen", ["siječnja"] = "m.gen", ["veljače"] = "m.gen", ["ožujka"] = "m.gen",
        ["studenoga"] = "m.gen", ["prosinca"] = "m.gen",
        ["svjetskog"] = "m.gen", ["svjetskom"] = "m.loc", ["svjetski"] = "m.nom", ["svjetskoga"] = "m.gen",
        ["reda"] = "m.gen", ["redu"] = "m.loc",
    };

    // -----------------------------------------------------------------------------------------------
    // COUNTED NOUNS
    // -----------------------------------------------------------------------------------------------

    /** Pick a three-form Slavic count noun for `n`: [nom.sg, gen.sg (2–4), gen.pl]. */
    private static string Counted(double n, string[] forms) =>
        forms[Math.Min(NormalizeSymbols.SlavicCountForm(n), 2)];

    private static readonly string[] SAT = { "sat", "sata", "sati" };
    private static readonly string[] MINUT = { "minut", "minuta", "minuta" };
    private static readonly string[] MILJA = { "milja", "milje", "milja" };
    private static readonly string[] STUPANJ = { "stupanj", "stupnja", "stupnjeva" };

    private static readonly JsRe INT_OF_DOT = JsRegex.Compile("\\.", "gu");

    /** Integer part of a Croatian-written number ("2,4" → 2), for the local count-agreement calls. */
    private static double IntOf(string n) =>
        Math.Truncate(Js.Number(Js.ReplaceFirst(INT_OF_DOT.Replace(n, ""), ",", ".")));

    // -----------------------------------------------------------------------------------------------
    // THE RULES
    // -----------------------------------------------------------------------------------------------

    private static readonly JsRe ZERO_WIDTH = JsRegex.Compile("[\\u200B\\u200C\\u200D\\uFEFF]", "gu");
    private static readonly JsRe DEGROUP = JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0)\\.(?=\\d{3}(?!\\d))", "gu");
    private static readonly JsRe ENDASH_ERA_RANGE =
        JsRegex.Compile("(\\d{1,4})\\.\\s*[-–—]\\s*(\\d{1,4})\\.(?=\\s*(?:n\\.\\s?e\\.|p\\.\\s?n\\.\\s?e\\.))", "gu");
    private static readonly JsRe ERA_YEAR = JsRegex.Compile(
        "(?<![\\d.,])(\\d{1,4})\\.\\s+(?:g\\.\\s+)?(?=(?:n\\.\\s?e|p\\.\\s?n\\.\\s?e|pr\\.\\s?Kr\\.)(?![\\p{L}\\p{M}]))", "gu");
    private static readonly JsRe PNE_END = JsRegex.Compile("(?<![\\p{L}\\p{M}])p\\.\\s?n\\.\\s?e\\.(?=[.!?]|$)", "gu");
    private static readonly JsRe PNE_SP = JsRegex.Compile("(?<![\\p{L}\\p{M}])p\\.\\s?n\\.\\s?e\\.(\\s)", "gu");
    private static readonly JsRe NE_END = JsRegex.Compile("(?<![\\p{L}\\p{M}])n\\.\\s?e\\.(?=[.!?]|$)", "gu");
    private static readonly JsRe NE_SP = JsRegex.Compile("(?<![\\p{L}\\p{M}])n\\.\\s?e\\.(\\s)", "gu");
    private static readonly JsRe PRKR_END = JsRegex.Compile("(?<![\\p{L}\\p{M}])pr\\.\\s?Kr\\.(?=[.!?]|$)", "gu");
    private static readonly JsRe PRKR_SP = JsRegex.Compile("(?<![\\p{L}\\p{M}])pr\\.\\s?Kr\\.(\\s)", "gu");
    private static readonly JsRe ERA_G_DROP =
        JsRegex.Compile("(?<=\\d)\\s+g\\.\\s+(?=(?:n\\.\\s?e\\.|pr\\.\\s?Kr\\.))", "gu");
    private static readonly JsRe ITD_MID = JsRegex.Compile("(?<![\\p{L}\\p{M}])itd\\.(\\s+)(?=[\\p{L}\\d(])", "giu");
    private static readonly JsRe ITD_COMMA = JsRegex.Compile("(?<![\\p{L}\\p{M}])itd\\.(?=\\s*[,;:])", "giu");
    private static readonly JsRe ITD_END = JsRegex.Compile("(?<![\\p{L}\\p{M}])itd\\.(?=\\s*(?:[.!?”\"»)\\]])|$)", "giu");
    private static readonly JsRe INITIAL_RUN = JsRegex.Compile("(?<![\\p{L}\\p{M}])\\p{Lu}\\.(?:[ \\u00a0]?\\p{Lu}\\.)+", "gu");
    private static readonly JsRe DOT_OR_SPACE = JsRegex.Compile("[.\\s]", "gu");
    private static readonly JsRe LONE_INITIAL = JsRegex.Compile("(?<=\\p{Lu}\\p{L}*\\s)(\\p{Lu})\\.(?=\\s+\\p{Lu}\\p{Ll})", "gu");
    private static readonly JsRe DR_MID = JsRegex.Compile("(?<![\\p{L}\\p{M}])Dr\\.(\\s+)(?=[\\p{L}\\d])", "giu");
    private static readonly JsRe DR_END = JsRegex.Compile("(?<![\\p{L}\\p{M}])Dr\\.(?=\\s*(?:[.,;:!?»)]|$))", "giu");
    private static readonly JsRe SAD_SUFFIXED = JsRegex.Compile("(?<![-\\p{L}\\p{M}])SAD(?=-)", "gu");
    private static readonly JsRe ROMAN_PRENOMINAL =
        JsRegex.Compile("(?<![\\p{L}\\p{M}])([IVXL]+)\\.\\s+(\\p{Ll}[\\p{L}\\p{M}]*)", "gu");
    private static readonly JsRe DEG_SCALE = JsRegex.Compile("(\\d+)\\s?°\\s?([CFcf])(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe FAHRENHEIT = JsRegex.Compile("[Ff]", "u");
    private static readonly JsRe DEG_BEARING =
        JsRegex.Compile("(\\d+)\\s?°(?:\\s?([NEWSnew])|([s]))(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d+)\\s?°(?:\\s?[QXYqxy](?![\\p{L}\\p{M}]))?", "gu");
    private static readonly JsRe SUFFIXED =
        JsRegex.Compile($"(?<![\\d.,])(\\d+)\\s?-\\s?(\\p{{Ll}}{{1,2}}){Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe ORDINAL_N = JsRegex.Compile("(?<![\\d.,])(\\d{1,4})\\.\\s+(\\p{Ll}[\\p{L}\\p{M}]*)", "gu");
    private static readonly JsRe ELIDED_YEAR = JsRegex.Compile("(?<![\\d.,\\-])(1\\d{3}|20\\d{2}|2100)\\.(?!\\d)", "gu");
    private static readonly JsRe YEAR_TRAIL = JsRegex.Compile("^[\\s)»\"'\\]]+", "u");
    private static readonly JsRe YEAR_UPPER = JsRegex.Compile("^[\\p{Lu}]", "u");
    private static readonly JsRe CLOCK =
        JsRegex.Compile("(?<![\\d:.,])([01]?\\d|2[0-3]):([0-5]\\d)(?![:.\\d])(?:\\s*h)?", "giu");
    private static readonly JsRe RANGE = JsRegex.Compile("(\\d)\\s?[-–—]\\s?(?=\\d)", "gu");
    private static readonly JsRe MILJA_RATE =
        JsRegex.Compile("(\\d+(?:,\\d+)?)\\s?milja\\s*\\/\\s*(?:sat|h)(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(?<=\\d),(?=\\d)", "gu");
    private static readonly JsRe THREE_QUARTERS = JsRegex.Compile("(\\d+)¾", "gu");
    private static readonly JsRe HALF = JsRegex.Compile("(\\d+)½", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d/])(\\d{1,3})\\/(\\d{1,3})(?![\\d/])", "gu");
    private static readonly JsRe AMP_INITIALS = JsRegex.Compile("(?<!\\p{L}\\p{M})(\\p{Lu})&(\\p{Lu})(?![^\\p{L}\\p{M}])", "gu");
    private static readonly JsRe AMP_SPACED = JsRegex.Compile("\\s&\\s", "gu");
    private static readonly JsRe TIMES = JsRegex.Compile("(?<=\\d)\\s?[x×]\\s?(?=\\d)", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS_START = JsRegex.Compile("(^|[\\s(])\\+\\s?(\\d)", "gu");
    private static readonly JsRe PLUS_AFTER_CAP = JsRegex.Compile("(?<=[A-Z])\\+(\\d)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(?<![\\p{L}\\p{Nd}])[−-](\\d+)(?!\\s*[-–—\\d])", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("(\\S)\\s*=\\s*(\\S)", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("(\\d)\\s*<\\s*(\\d)", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("(\\d)\\s*>\\s*(\\d)", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("(\\S)\\s*÷\\s*(\\S)", "gu");

    /** The roman ordinals the prenominal rule reads — the shared roman pass declines a single-letter I. */
    private static readonly IReadOnlyDictionary<string, string> ROMAN_ORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["I"] = "prvi", ["II"] = "drugi", ["III"] = "treći", ["IV"] = "četvrti", ["V"] = "peti",
    };

    private static readonly IReadOnlyDictionary<string, string> BEARING = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["N"] = "sjeverno", ["S"] = "južno", ["E"] = "istočno", ["W"] = "zapadno",
    };

    /** Normalize one Croatian input string. Pure text→text. */
    public static string NormalizeCroatian(string input)
    {
        var s = input;

        // 0) ZERO-WIDTH.
        s = ZERO_WIDTH.Replace(s, "");

        // 1) DIGIT DE-GROUPING, FIRST. Two passes, because adjacent groups share a digit.
        for (var i = 0; i < 2; i++) s = DEGROUP.Replace(s, "");
        s = ENDASH_ERA_RANGE.Replace(s, "$1 do $2");

        // 2) MULTI-DOT ERA MARKER, before the abbreviation and `N.` ordinal rules. ⚠ THE ERA PATTERNS ARE
        //    LOWERCASE-ONLY — `n.e.` is also two INITIALS with stops and this block runs first; see the TS.
        s = ERA_YEAR.Replace(s, m =>
        {
            var bas = OrdinalBase(Js.Number(m.Groups[1].Value));
            return bas is null ? m.Value : $"{Inflect(bas, "f.gen")} ";
        });
        s = PNE_END.Replace(s, "prije nove ere.");
        s = PNE_SP.Replace(s, "prije nove ere$1");
        s = NE_END.Replace(s, "nove ere.");
        s = NE_SP.Replace(s, "nove ere$1");
        s = PRKR_END.Replace(s, "prije Krista.");
        s = PRKR_SP.Replace(s, "prije Krista$1");
        s = ERA_G_DROP.Replace(s, " ");

        // 3) DOTTED ABBREVIATIONS.
        s = ITD_MID.Replace(s, "i tako dalje$1");
        s = ITD_COMMA.Replace(s, "i tako dalje");
        s = ITD_END.Replace(s, "i tako dalje.");

        // 4) DOTTED CAPITAL RUNS, then the lone initial, then Dr. / SAD.
        s = INITIAL_RUN.Replace(s, m => DOT_OR_SPACE.Replace(m.Value, ""));
        s = LONE_INITIAL.Replace(s, "$1");
        s = DR_MID.Replace(s, "Doktor$1");
        s = DR_END.Replace(s, "Doktor.");
        s = SAD_SUFFIXED.Replace(s, "Sjedinjene Američke Države");

        // 4b) PRENOMINAL ROMAN ORDINALS.
        s = ROMAN_PRENOMINAL.Replace(s, m =>
        {
            if (!ROMAN_ORD.TryGetValue(m.Groups[1].Value.ToUpperInvariant(), out var bas)) return m.Value;
            var word = m.Groups[2].Value;
            var slot = word.EndsWith("og", StringComparison.Ordinal) ? "m.gen"
                : word.EndsWith("om", StringComparison.Ordinal) ? "m.loc"
                : word.EndsWith("e", StringComparison.Ordinal) || word.EndsWith("a", StringComparison.Ordinal) ? "m.gen"
                : "m.nom";
            var ord = Inflect(bas, slot);
            return ord is null ? m.Value : $"{ord} {word}";
        });

        // 5) DEGREES — the scale, then the compass bearing.
        s = DEG_SCALE.Replace(s, m =>
            $"{m.Groups[1].Value} {(FAHRENHEIT.IsMatch(m.Groups[2].Value) ? "stupnjeva Farenhajta" : "stupnjeva Celzija")}");
        s = DEG_BEARING.Replace(s, m =>
        {
            var letter = m.Groups[2].Success ? m.Groups[2].Value : m.Groups[3].Value;
            return $"{m.Groups[1].Value} stupnjeva {BEARING[letter.ToUpperInvariant()]}";
        });

        // 5b) THE BARE DEGREE. ⚠ THE TRAILING SPACE IS LOAD-BEARING — any letter this arm does not consume
        //     would otherwise glue onto the noun and send the stress lookup to a word that does not exist.
        s = DEG_BARE.Replace(s, m => $"{m.Groups[1].Value} {Counted(IntOf(m.Groups[1].Value), STUPANJ)} ");

        // 6) NUMERAL + HYPHEN + CASE SUFFIX. Before the range rule.
        s = SUFFIXED.Replace(s, m =>
            OrdinalForms(Js.Number(m.Groups[1].Value))
                .FirstOrDefault(f => f.EndsWith(Js.ToLowerCase(m.Groups[2].Value), StringComparison.Ordinal))
            ?? m.Value);

        // 7) THE `N.` ORDINAL — only before a LOWERCASE licensing word.
        s = ORDINAL_N.Replace(s, m =>
        {
            var word = m.Groups[2].Value;
            if (!LICENSOR.TryGetValue(word, out var slot)) return m.Value;
            var bas = OrdinalBase(Js.Number(m.Groups[1].Value));
            return bas is null ? m.Value : $"{Inflect(bas, slot)} {word}";
        });

        // 7b) A YEAR WITH `godine` ELIDED. The period survives only where it is ALSO a sentence end.
        var yearSubject = s;
        s = ELIDED_YEAR.Replace(s, m =>
        {
            var bas = OrdinalBase(Js.Number(m.Groups[1].Value));
            if (bas is null) return m.Value;
            var year = Inflect(bas, "f.gen");
            if (year is null) return m.Value;
            var rest = YEAR_TRAIL.Replace(yearSubject[(m.Index + m.Value.Length)..], "");
            var sentenceEnd = rest.Length == 0 || YEAR_UPPER.IsMatch(rest);
            return $"{year}{(sentenceEnd ? "." : "")}";
        });

        // 8) CLOCK, colon form, with the Croatian `h` (sat) suffix.
        s = CLOCK.Replace(s, m =>
        {
            double hv = Js.Number(m.Groups[1].Value), mv = Js.Number(m.Groups[2].Value);
            if (hv > 23 || mv > 59) return m.Value;
            var head = $"{Numbers.NumberToWords(hv)} {Counted(hv, SAT)}";
            return mv == 0 ? head : $"{head} i {Numbers.NumberToWords(mv)} {Counted(mv, MINUT)}";
        });

        // 9) NUMERIC RANGES.
        s = RANGE.Replace(s, "$1 do ");

        // 9b) MILJA RATE — the tier's `mi` key does not match the spelled "milja".
        s = MILJA_RATE.Replace(s, m => $"{m.Groups[1].Value} {Counted(IntOf(m.Groups[1].Value), MILJA)} na sat");

        // 10) THE SHARED SYMBOL TIER — the number must still be adjacent to its unit and still carry its
        //     decimal comma, so it runs before step 11.
        s = CroatianPhonemizer.SYMBOLS(s);

        // 11) DECIMAL COMMA → the word.
        s = DECIMAL_COMMA.Replace(s, " zarez ");

        // 12) FRACTIONS.
        s = THREE_QUARTERS.Replace(s, "$1 i tri četvrtine");
        s = HALF.Replace(s, "$1 i pol");
        s = FRACTION.Replace(s, m =>
        {
            var ord = OrdinalBase(Js.Number(m.Groups[2].Value));
            return ord is null ? m.Value : $"{Numbers.NumberToWords(Js.Number(m.Groups[1].Value))} {ord}";
        });

        // 13) SIGNS. ⚠ `±` IS ONE CHARACTER (U+00B1), so no `+` rule can ever match inside it.
        s = AMP_INITIALS.Replace(s, "$1 i $2");
        s = AMP_SPACED.Replace(s, " i ");
        s = TIMES.Replace(s, " puta ");
        s = PLUS_MINUS.Replace(s, " plus minus ");
        s = PLUS_START.Replace(s, "$1plus $2");
        s = PLUS_AFTER_CAP.Replace(s, " plus $1");
        s = MINUS.Replace(s, "minus $1");
        s = EQUALS.Replace(s, "$1 jednako $2");
        s = LESS_THAN.Replace(s, "$1 manje od $2");
        s = GREATER_THAN.Replace(s, "$1 veće od $2");
        s = DIVIDE.Replace(s, "$1 podijeljeno s $2");

        // ⚠ INITIALISMS, LAST, AND SHARED WITH SERBIAN — one table, three engines.
        return SR.Normalize.NormalizeSerbianInitialisms(s);
    }
}

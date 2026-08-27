/**
 * Bosnian (bs) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; every rule accepts BOTH scripts.
 * The initialism pass at the end is Serbian's, shared by all three standards.
 * Ported from src/languages/bosnian/normalize.ts — see that file for the corpus evidence and for why each
 * arm is NEITHER sibling's.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Bosnian;

public static class Normalize
{
    private static Serbian.SerbianNumbers N => Manifest.MANIFEST.Numbers;

    // -----------------------------------------------------------------------------------------------
    // SCRIPT
    // -----------------------------------------------------------------------------------------------

    /** Bosnian Cyrillic → Gaj's Latin, a strict bijection. */
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

    /** Latin → Cyrillic, the inverse of the SINGLE-character entries only. */
    private static readonly IReadOnlyDictionary<string, string> LAT2CYR =
        CYR2LAT.Where(kv => kv.Value.Length == 1).ToDictionary(kv => kv.Value, kv => kv.Key, StringComparer.Ordinal);

    private static string Cyr(string word)
    {
        var outp = new System.Text.StringBuilder();
        foreach (var ch in Js.CodePoints(word)) outp.Append(LAT2CYR.TryGetValue(ch, out var c) ? c : ch);
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
        "", "stoti", "dvjestoti", "tristoti", "četiristoti", "petstoti", "šeststoti", "sedamstoti",
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
        if (r == 0) return null; // dvijehiljaditi & co. — not attempted
        return $"{Numbers.NumberToWords(n - r)} {OrdinalBase(r)}";
    }

    /** Definite-adjective endings, [HARD stem, SOFT stem]. ⚠ INSERTION-ORDERED: `OrdinalForms` returns them
     *  in this order and step 6 keeps the FIRST whose tail matches the written suffix. */
    private static readonly (string Slot, string Hard, string Soft)[] ENDINGS =
    {
        ("m.nom", "i", "i"), ("m.gen", "og", "eg"), ("m.loc", "om", "em"), ("m.ins", "im", "im"),
        ("n.nom", "o", "e"), ("n.gen", "og", "eg"), ("n.loc", "om", "em"),
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

    /** Every slot's form for `n`, for the suffix-matching rule (step 6). */
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
        ["stoljeća"] = "n.gen", ["stoljeću"] = "n.loc", ["stoljeće"] = "n.nom",
        ["vijeka"] = "m.gen", ["vijeku"] = "m.loc", ["vijek"] = "m.nom",
        ["januara"] = "m.gen", ["februara"] = "m.gen", ["marta"] = "m.gen", ["aprila"] = "m.gen", ["maja"] = "m.gen",
        ["juna"] = "m.gen", ["jula"] = "m.gen", ["avgusta"] = "m.gen", ["septembra"] = "m.gen", ["oktobra"] = "m.gen",
        ["novembra"] = "m.gen", ["decembra"] = "m.gen",
        ["mjesto"] = "n.nom", ["mjestu"] = "n.loc", ["dana"] = "m.gen", ["kategorije"] = "f.gen", ["najvećim"] = "m.ins",
        ["husarska"] = "f.nom", ["pukovnija"] = "f.nom", ["pukovniju"] = "f.acc", ["zemlja"] = "f.nom", ["gol"] = "m.nom",
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
    private static readonly string[] MILJA = { "milja", "milje", "milja" };
    private static readonly string[] MEGABIT = { "megabit", "megabita", "megabita" };

    /** Dotted abbreviations whose dot is NOT a sentence end. */
    private static readonly IReadOnlyDictionary<string, string> DOTTED = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["itd"] = "i tako dalje",
        ["npr"] = "naprimjer",
        ["tj"] = "to jest",
        ["str"] = "strana",
        ["br"] = "broj",
    };

    /** ⚠ BOTH SCRIPTS in the alternation, or the rule is a no-op on Cyrillic prose. Longest-first, and the
     *  sort is STABLE on both sides so ties keep declaration order. */
    private static readonly string DOTTED_ALT = string.Join("|",
        DOTTED.Keys.SelectMany(k => new[] { k, Cyr(k) }).OrderByDescending(a => a.Length));

    /** The connectives that coordinate two ordinals (step 9b), in both scripts. */
    private static readonly string CONNECTIVE_ALT = string.Join("|",
        new[] { "i", "ili", "do" }.SelectMany(k => new[] { k, Cyr(k) }).OrderByDescending(a => a.Length));

    /** The shared symbol tier. Unit keys are Latin only — unit abbreviations are written in Latin even in
     *  Cyrillic prose. `/s` is composed locally in step 7: its Bosnian rate is "u sekundi", not `unitPer`. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Ampersand = "i",
        Multiply = new MultiplyDef { Times = "puta", By = "sa" },
        Percent = new[] { "posto" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["AUD$"] = new[] { "australijski dolar", "australijska dolara", "australijskih dolara" },
            ["$"] = new[] { "dolar", "dolara", "dolara" },
        },
        Magnitudes = new[] { "hiljada", "miliona", "milion", "milijarde", "milijardi", "milijarda", "biliona" },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilometar", "kilometra", "kilometara" },
            ["m"] = new[] { "metar", "metra", "metara" },
            ["mm"] = new[] { "milimetar", "milimetra", "milimetara" },
            ["cm"] = new[] { "centimetar", "centimetra", "centimetara" },
            ["kg"] = new[] { "kilogram", "kilograma", "kilograma" },
            ["mi"] = new[] { "milja", "milje", "milja" },
            ["ghz"] = new[] { "gigaherc", "gigaherca", "gigaherca" },
        },
        UnitPer = "na",
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal) { ["h"] = "sat" },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "kvadratni", "kvadratna", "kvadratnih" },
            Position = "before",
        },
        CountForm = NormalizeSymbols.SlavicCountForm,
    });

    // -----------------------------------------------------------------------------------------------
    // The rules
    // -----------------------------------------------------------------------------------------------

    private static readonly JsRe DEGROUP = JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0)\\.(?=\\d{3}(?!\\d))", "gu");
    // ⚠ BOTH SCRIPTS — Cyrillic ⟨п н е⟩ and Latin ⟨p n e⟩ are distinct code points that look alike, so one
    // class alone is a no-op on the other script's prose. See the TS.
    private static readonly (JsRe Dotted, JsRe Bare)[] ERA_RES =
        new[] { "p\\.\\s?n\\.\\s?e", "п\\.\\s?н\\.\\s?е" }.Select(marker =>
            (JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}]){marker}\\.(\\s*)(\\S?)", "giu"),
             JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}]){marker}(?![\\p{{L}}\\p{{M}}.])", "giu"))).ToArray();
    private static readonly JsRe ABBREV_MID =
        JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({DOTTED_ALT})\\.(\\s+)(?=[\\p{{L}}\\d(])", "giu");
    private static readonly JsRe ABBREV_COMMA =
        JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({DOTTED_ALT})\\.(?=\\s*[,;:])", "giu");
    private static readonly JsRe ABBREV_END =
        JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({DOTTED_ALT})\\.(?=\\s*(?:[.!?”\"»)\\]]|$))", "giu");
    private static readonly JsRe LONE_INITIAL = JsRegex.Compile("(?<=\\p{Lu}\\p{L}*\\s)(\\p{Lu})\\.(?=\\s+\\p{Lu}\\p{Ll})", "gu");
    // ⚠ `gu`, NOT `giu` — a lowercase `dr.` is the academic *et al.* and must NOT become *doktor*.
    private static readonly JsRe DR_MID = JsRegex.Compile("(?<![\\p{L}\\p{M}])Dr\\.(\\s+)(?=[\\p{L}\\d])", "gu");
    private static readonly JsRe DR_END = JsRegex.Compile("(?<![\\p{L}\\p{M}])Dr\\.(?=\\s*(?:[.,;:!?»)]|$))", "gu");
    private static readonly JsRe SAD_GEN = JsRegex.Compile("(?<![-\\p{L}\\p{M}])SAD-a(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DEG_SCALE = JsRegex.Compile("(\\d+)\\s?°\\s?([CFСcf])(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe FAHRENHEIT = JsRegex.Compile("[Ff]", "u");
    private static readonly JsRe DEG_BEARING =
        JsRegex.Compile("(\\d+)\\s?°(?:\\s?([JZNEWSIjznew])|([si]))(?![\\p{L}\\p{M}])", "gu");
    // ⚠ THE WHITESPACE IS INSIDE THE OPTIONAL GROUP, and the replacement ENDS IN A SPACE — see the TS: both
    // are what stop `35° od ekvatora` and `300°K` from gluing onto the degree noun.
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d+)\\s?°(?:\\s?[XYQxyq](?![\\p{L}\\p{M}]))?", "gu");
    private static readonly JsRe SUFFIXED =
        JsRegex.Compile($"(?<![\\d.,])(\\d+)\\s?-\\s?(\\p{{Ll}}{{1,2}}){Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe MBIT_S = JsRegex.Compile("(\\d+(?:[.,]\\d+)?)\\s?Mbit\\s?\\/\\s?s(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe M_S = JsRegex.Compile("(\\d+(?:[.,]\\d+)?)\\s?m\\s?\\/\\s?s(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe MILJA_RATE =
        JsRegex.Compile("(\\d+(?:,\\d+)?)\\s?milja\\s*\\/\\s*(?:sat|h)(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe CLOCK_SPAN = JsRegex.Compile("(\\d{1,2}:\\d{2})\\s?[-–—]\\s?(?=\\d{1,2}:\\d{2})", "gu");
    private static readonly JsRe CLOCK =
        JsRegex.Compile("(?<![\\d:.,])([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:.,])(\\s*(?:sati|sata|časova|sahati|sahata))?", "giu");
    private static readonly JsRe YEAR_SPAN =
        JsRegex.Compile("(?<![\\d.,])(1\\d{3}|20\\d{2}|2100)\\s?[-–—]\\s?(1\\d{3}|20\\d{2}|2100)\\.(?=\\s+\\p{Ll})", "gu");
    private static readonly JsRe ORDINAL_PAIR = JsRegex.Compile(
        $"(?<![\\d.,])(\\d{{1,4}})\\.\\s+({CONNECTIVE_ALT})\\s+(\\d{{1,4}})\\.\\s+(\\p{{Ll}}[\\p{{L}}\\p{{M}}]*)", "gu");
    private static readonly JsRe ORDINAL_N = JsRegex.Compile("(?<![\\d.,])(\\d{1,4})\\.\\s+(\\p{Ll}[\\p{L}\\p{M}]*)", "gu");
    // ⚠ THE LOOKBEHIND REJECTS ALL THREE DASHES, not only the ASCII hyphen — see the TS (trap 58).
    private static readonly JsRe BARE_YEAR = JsRegex.Compile("(?<![\\d.,\\-–—])(1\\d{3}|20\\d{2}|2100)\\.(?!\\d)", "gu");
    private static readonly JsRe YEAR_TRAIL = JsRegex.Compile("^[\\s)»\"'\\]]+", "u");
    private static readonly JsRe UPPER_START = JsRegex.Compile("^[\\p{Lu}]", "u");
    private static readonly JsRe RANGE = JsRegex.Compile("(\\d)\\s?[-–—]\\s?(?=\\d)", "gu");
    private static readonly JsRe THREE_QUARTERS = JsRegex.Compile("(\\d+)¾", "gu");
    private static readonly JsRe ONE_HALF = JsRegex.Compile("(\\d+)½", "gu");
    private static readonly JsRe PLUS_SIGN = JsRegex.Compile("(^|[\\s(])\\+\\s?(\\d)", "gu");
    private static readonly JsRe PLUS_AFTER_CAP = JsRegex.Compile("(?<=\\p{Lu})\\+(?=\\d)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(?<![\\p{L}\\p{M}\\p{Nd}])[-−–](?=\\d)", "gu");
    private static readonly JsRe DIGIT_LEFT = JsRegex.Compile("\\d\\s*$", "u");
    private static readonly JsRe GROUP_DOT = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe ERA_PUNCT = JsRegex.Compile("[,;:!?)»”\"]", "u");
    private static readonly JsRe UPPER = JsRegex.Compile("\\p{Lu}", "u");

    private static readonly IReadOnlyDictionary<string, string> BEARING = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["S"] = "sjeverno", ["J"] = "južno", ["I"] = "istočno", ["Z"] = "zapadno",
        ["N"] = "sjeverno", ["E"] = "istočno", ["W"] = "zapadno",
    };

    /** Normalize one Bosnian input string. Pure text→text. */
    public static string NormalizeBosnian(string input)
    {
        var s = input;

        // 0) DIGIT DE-GROUPING, FIRST. Two passes, because adjacent groups share a digit (`10.000`).
        for (var i = 0; i < 2; i++) s = DEGROUP.Replace(s, "");

        // 1) THE ERA MARKER, before the dotted-abbreviation rule and the `N.` ordinal rule.
        foreach (var (dotted, bare) in ERA_RES)
        {
            s = dotted.Replace(s, m => ReplaceEra("prije nove ere", m.Groups[1].Value, m.Groups[2].Value));
            s = bare.Replace(s, _ => "prije nove ere");
        }

        // 2) DOTTED ABBREVIATIONS, three arms.
        // ⚠ THE CASE TEST RUNS IN THE CALLBACK, not in the lookahead: `\p{Ll}`/`\p{Lu}` inside an `i`-flagged
        // pattern matches either case, so a guard in the pattern would be a no-op.
        var abbrevSubject = s;
        s = ABBREV_MID.Replace(s, m =>
        {
            var after = m.Index + m.Length;
            var next = after < abbrevSubject.Length ? abbrevSubject.Substring(after, 1) : "";
            if (!DOTTED.TryGetValue(Lat(m.Groups[1].Value), out var w)) return m.Value;  // ⚠ reachable miss (#1122)
            return $"{w}{(UPPER.IsMatch(next) ? "." : "")}{m.Groups[2].Value}";
        });
        s = ABBREV_COMMA.Replace(s, m => DOTTED.TryGetValue(Lat(m.Groups[1].Value), out var w) ? w : m.Value);
        s = ABBREV_END.Replace(s, m => DOTTED.TryGetValue(Lat(m.Groups[1].Value), out var w) ? $"{w}." : m.Value);

        // 3) LONE INITIAL IN A NAME, then `Dr.` — case-sensitively, so lowercase `dr.` (the academic *et al.*)
        //    is left alone.
        s = LONE_INITIAL.Replace(s, "$1");
        s = DR_MID.Replace(s, "doktor$1");
        s = DR_END.Replace(s, "doktor.");

        // 4) `SAD-a` — the genitive of the USA. Bare `SAD` is deliberately not claimed.
        s = SAD_GEN.Replace(s, "Sjedinjenih Američkih Država");

        // 5) DEGREES, three arms: the scale, the compass bearing, then the bare degree.
        s = DEG_SCALE.Replace(s, m =>
            $"{m.Groups[1].Value} {Counted(Js.Number(m.Groups[1].Value), STEPEN)} " +
            (FAHRENHEIT.IsMatch(m.Groups[2].Value) ? "Farenhajta" : "Celzijusa"));
        s = DEG_BEARING.Replace(s, m =>
        {
            var letter = m.Groups[2].Success ? m.Groups[2].Value : m.Groups[3].Value;
            return $"{m.Groups[1].Value} {Counted(Js.Number(m.Groups[1].Value), STEPEN)} {BEARING[letter.ToUpperInvariant()]}";
        });
        s = DEG_BARE.Replace(s, m => $"{m.Groups[1].Value} {Counted(Js.Number(m.Groups[1].Value), STEPEN)} ");

        // 6) NUMERAL + HYPHEN + CASE SUFFIX (`1970-ih`). MUST run before the range rule (step 11b).
        s = SUFFIXED.Replace(s, m =>
        {
            var suffix = Lat(m.Groups[2].Value);
            return OrdinalForms(Js.Number(m.Groups[1].Value)).FirstOrDefault(f => f.EndsWith(suffix, StringComparison.Ordinal))
                ?? m.Value;
        });

        // 7) RATES THE SHARED TIER CANNOT EXPRESS — the `/s` rate takes "u sekundi", not `unitPer`'s "na".
        s = MBIT_S.Replace(s, m => $"{m.Groups[1].Value} {Counted(IntOf(m.Groups[1].Value), MEGABIT)} u sekundi");
        s = M_S.Replace(s, m => $"{m.Groups[1].Value} {Counted(IntOf(m.Groups[1].Value), METAR)} u sekundi");
        s = MILJA_RATE.Replace(s, m => $"{m.Groups[1].Value} {Counted(IntOf(m.Groups[1].Value), MILJA)} na sat");

        // 7c) A SPAN BETWEEN TWO CLOCKS, before the clock rule turns its endpoints into words.
        s = CLOCK_SPAN.Replace(s, "$1 do ");

        // 8) THE CLOCK, IN THE COLON FORM — and the written hour noun is CONSUMED.
        s = CLOCK.Replace(s, m =>
        {
            double hv = Js.Number(m.Groups[1].Value), mv = Js.Number(m.Groups[2].Value);
            var head = $"{Numbers.NumberToWords(hv)} {Counted(hv, SAT)}";
            return mv == 0 ? head : $"{head} i {Numbers.NumberToWords(mv)} {Counted(mv, MINUT)}";
        });

        // 9) A LICENSED YEAR–YEAR SPAN, claimed as a UNIT and before everything else that touches a range:
        //    when the dot is licensed BOTH endpoints are ordinal.
        s = YEAR_SPAN.Replace(s, m =>
        {
            var a = OrdinalBase(Js.Number(m.Groups[1].Value));
            var b = OrdinalBase(Js.Number(m.Groups[2].Value));
            if (a is null || b is null) return m.Value; // round thousands — see OrdinalBase
            return $"{Inflect(a, "f.gen")} do {Inflect(b, "f.gen")}";
        });

        // 9b) A COORDINATED ORDINAL PAIR (`10. i 11. stoljeća`) — BOTH conjuncts take the slot the WRITTEN
        //     licensor governs. Steps 10 and 11 see one numeral at a time and between them left the first
        //     conjunct either unread or in the wrong case; see the TS.
        s = ORDINAL_PAIR.Replace(s, m =>
        {
            var word = m.Groups[4].Value;
            if (!LICENSOR.TryGetValue(Lat(word), out var slot)) return m.Value;
            var a = OrdinalBase(Js.Number(m.Groups[1].Value));
            var b = OrdinalBase(Js.Number(m.Groups[3].Value));
            if (a is null || b is null) return m.Value; // round thousands — see OrdinalBase
            return $"{Inflect(a, slot)} {m.Groups[2].Value} {Inflect(b, slot)} {word}";
        });

        // 10) THE `N.` ORDINAL — only before a LOWERCASE licensing word from the closed list.
        s = ORDINAL_N.Replace(s, m =>
        {
            var word = m.Groups[2].Value;
            if (!LICENSOR.TryGetValue(Lat(word), out var slot)) return m.Value;
            var bas = OrdinalBase(Js.Number(m.Groups[1].Value));
            if (bas is null) return m.Value; // round thousands — see OrdinalBase
            return $"{Inflect(bas, slot)} {word}";
        });

        // 11) A YEAR WITH `godine` ELIDED. The period is kept only where it is ALSO a sentence end.
        var yearSubject = s;
        s = BARE_YEAR.Replace(s, m =>
        {
            var bas = OrdinalBase(Js.Number(m.Groups[1].Value));
            if (bas is null) return m.Value;
            var year = Inflect(bas, "f.gen");
            if (year is null) return m.Value;
            var rest = YEAR_TRAIL.Replace(yearSubject[(m.Index + m.Length)..], "");
            var sentenceEnd = rest.Length == 0 || UPPER_START.IsMatch(rest);
            return $"{year}{(sentenceEnd ? "." : "")}";
        });

        // 11b) THE GENERAL NUMERIC RANGE — AFTER the two ordinal rules, which is the ordering trap 58 turns on.
        s = RANGE.Replace(s, "$1 do ");

        // 12) THE SHARED SYMBOL TIER — it must see the number still adjacent to its unit and still carrying
        //     its decimal comma, so it runs before step 13.
        s = SYMBOLS(s);

        // 13) DECIMAL COMMA → *zarez*. LAST among the numeric rules, because it destroys the number.
        // ⚠ FROM THE SHARED CORE — the line was copied into all three standards, which is how the dropped
        // leading zero (`0,001` → *nula zarez jedan*, a 100× error) was one defect in three places.
        s = Serbian.Normalize.ReadDecimalComma(s);

        // 14) VULGAR FRACTIONS. ⚠ REACHABLE ONLY BECAUSE `bs` IS IN `Registry.VULGAR_FOLD_OPT_OUT` — the
        //     shared fold rewrites `¾` to ` 3/4` before the engine runs, and bs has no `n/m` rule to catch it.
        s = THREE_QUARTERS.Replace(s, "$1 i tri četvrtine");
        s = ONE_HALF.Replace(s, "$1 i po");

        // 15) THE SIGNS THAT REMAIN.
        s = PLUS_SIGN.Replace(s, "$1plus $2");
        s = PLUS_AFTER_CAP.Replace(s, " plus ");
        var minusSubject = s;
        s = MINUS.Replace(s, m => DIGIT_LEFT.IsMatch(minusSubject[..m.Index]) ? m.Value : "minus ");

        // INITIALISMS, LAST, AND SHARED WITH SERBIAN — hr/bs run its g2p, so they run its letter names too.
        return Serbian.Normalize.NormalizeSerbianInitialisms(s);
    }

    /** Integer part of a Bosnian-written number ("3,50" → 3), for the local count-agreement calls. */
    private static double IntOf(string n) =>
        Math.Truncate(Js.Number(Js.ReplaceFirst(GROUP_DOT.Replace(n, ""), ",", ".")));

    /** The era-marker replacer (step 1). Keeps the final dot only when it was ALSO the sentence end; a
     *  following punctuation mark already carries the break, so the dot is consumed rather than doubled. */
    private static string ReplaceEra(string words, string sp, string next)
    {
        if (next.Length == 0) return $"{words}.";
        if (ERA_PUNCT.IsMatch(next)) return $"{words}{sp}{next}";
        if (UPPER.IsMatch(next)) return $"{words}.{sp}{next}";
        return $"{words}{sp}{next}";
    }
}

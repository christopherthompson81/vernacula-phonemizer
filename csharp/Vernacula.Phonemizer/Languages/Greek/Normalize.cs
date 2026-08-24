/**
 * Modern Greek (el) text normalization — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the pipeline speaks.
 * Ported from src/languages/greek/normalize.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Greek;

public static class Normalize
{

    /** Latin→Greek HOMOGLYPHS. */
    private static readonly IReadOnlyDictionary<string, string> HOMOGLYPH = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["A"] = "Α", ["B"] = "Β", ["E"] = "Ε", ["H"] = "Η", ["I"] = "Ι", ["K"] = "Κ", ["M"] = "Μ",
        ["N"] = "Ν", ["O"] = "Ο", ["P"] = "Ρ", ["T"] = "Τ", ["X"] = "Χ", ["Y"] = "Υ", ["Z"] = "Ζ",
        ["a"] = "α", ["e"] = "ε", ["i"] = "ι", ["k"] = "κ", ["o"] = "ο", ["p"] = "ρ", ["t"] = "τ",
        ["u"] = "υ", ["v"] = "ν", ["x"] = "χ", ["y"] = "υ",
    };

    /** LATIN letter → its GREEK letter name. */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["a"] = "έι", ["b"] = "μπι", ["c"] = "σι", ["d"] = "ντι", ["e"] = "ι", ["f"] = "εφ", ["g"] = "τζι",
        ["h"] = "έιτς", ["i"] = "άι", ["j"] = "τζέι", ["k"] = "κέι", ["l"] = "ελ", ["m"] = "εμ", ["n"] = "εν",
        ["o"] = "όου", ["p"] = "πι", ["q"] = "κιου", ["r"] = "αρ", ["s"] = "ες", ["t"] = "τι", ["u"] = "γιου",
        ["v"] = "βι", ["w"] = "ντάμπλιου", ["x"] = "εξ", ["y"] = "γουάι", ["z"] = "ζετ",
    };

    /** Acronyms Greek reads as a WORD rather than as letters. */
    private static readonly IReadOnlyDictionary<string, string> WORD_ACRONYM = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["UNESCO"] = "Ουνέσκο", ["NATO"] = "ΝΑΤΟ", ["NASA"] = "Νάσα", ["ISIS"] = "Ίσις",
        ["COVID"] = "Κόβιντ", ["ASUS"] = "Άσους",
    };

    /**
     * MIXED-CASE Latin is otherwise left to the foreign fallback, with one exception: `pH` is an initialism
     * that merely happens to carry a lowercase letter, so the all-caps rule cannot reach it.
     */
    private static readonly IReadOnlyDictionary<string, string> MIXED_CASE_INITIALISM =
        new Dictionary<string, string>(StringComparer.Ordinal) { ["pH"] = "πι έιτς" };

    /** Ordinals 1–12, masculine nominative — the citation form the inflector works from. */
    private static readonly string[] ORD_UNITS =
    {
        "", "πρώτος", "δεύτερος", "τρίτος", "τέταρτος", "πέμπτος", "έκτος", "έβδομος", "όγδοος",
        "ένατος", "δέκατος", "ενδέκατος", "δωδέκατος",
    };

    /** Ordinal tens, masculine nominative. All OXYTONE (…ός), which changes the endings — see `inflect`. */
    private static readonly string[] ORD_TENS =
    {
        "", "", "εικοστός", "τριακοστός", "τεσσαρακοστός", "πεντηκοστός", "εξηκοστός", "εβδομηκοστός",
        "ογδοηκοστός", "ενενηκοστός",
    };

    /**
     * Written ending → the ordinal's ending, for a BARYTONE stem (πρώτος, δέκατος, όγδοος) and for an OXYTONE
     * one (εικοστός, τριακοστός), which carries the accent on the ending itself.
     */
    private static readonly IReadOnlyDictionary<string, string[]> ORD_ENDING = new Dictionary<string, string[]>(StringComparer.Ordinal)
    {
        ["ος"] = new[] { "ος", "ός" },
        ["ου"] = new[] { "ου", "ού" },
        ["ης"] = new[] { "ης", "ής" },
        ["ο"] = new[] { "ο", "ό" },
        ["η"] = new[] { "η", "ή" },
        ["ός"] = new[] { "ος", "ός" },
        ["ού"] = new[] { "ου", "ού" },
        ["ής"] = new[] { "ης", "ής" },
        ["ό"] = new[] { "ο", "ό" },
        ["ή"] = new[] { "η", "ή" },
    };

    /** LONGEST FIRST, so `ου` is not matched as the shorter `ο` and `ης` not as `η`. */
    private static readonly string ORD_ALT = string.Join("|", ORD_ENDING.Keys.OrderByDescending(k => k.Length));

    /** Greek ALPHABETIC numerals, for the regnal/era numbers of step 2. ΣΤ (6) is a two-letter sign. */
    private static readonly IReadOnlyDictionary<string, int> GREEK_NUMERAL = new Dictionary<string, int>(StringComparer.Ordinal)
    {
        ["Α"] = 1, ["Β"] = 2, ["Γ"] = 3, ["Δ"] = 4, ["Ε"] = 5, ["ΣΤ"] = 6, ["Ϛ"] = 6, ["Ζ"] = 7,
        ["Η"] = 8, ["Θ"] = 9, ["Ι"] = 10, ["Κ"] = 20, ["Λ"] = 30, ["Μ"] = 40, ["Ν"] = 50, ["Ξ"] = 60,
        ["Ο"] = 70, ["Π"] = 80,
    };

    /** FEMININE hour cardinals. */
    private static readonly string[] HOUR_FEM =
    {
        "μηδέν", "μία", "δύο", "τρεις", "τέσσερις", "πέντε", "έξι", "εφτά", "οχτώ", "εννιά", "δέκα",
        "έντεκα", "δώδεκα", "δεκατρείς", "δεκατέσσερις", "δεκαπέντε", "δεκαέξι", "δεκαεφτά", "δεκαοχτώ",
        "δεκαεννιά", "είκοσι", "είκοσι μία", "είκοσι δύο", "είκοσι τρεις",
    };

    /** Minutes count λεπτά (neuter), so the plain neuter cardinals are right here. */
    private static readonly string[] MIN_UNITS = { "", "ένα", "δύο", "τρία", "τέσσερα", "πέντε", "έξι", "εφτά", "οχτώ", "εννιά" };
    private static readonly string[] MIN_TEENS =
    {
        "δέκα", "έντεκα", "δώδεκα", "δεκατρία", "δεκατέσσερα", "δεκαπέντε", "δεκαέξι", "δεκαεφτά",
        "δεκαοχτώ", "δεκαεννιά",
    };
    private static readonly string[] MIN_TENS = { "", "", "είκοσι", "τριάντα", "σαράντα", "πενήντα" };

    /** 1–59 as neuter cardinals, for the minutes of a clock time. */
    private static string MinuteWords(double m)
    {
        if (m < 10) return MIN_UNITS[(int)m];
        if (m < 20) return MIN_TEENS[(int)m - 10];
        var t = MIN_TENS[(int)Math.Floor(m / 10)];
        var u = (int)(m % 10);
        return u == 0 ? t : $"{t} {MIN_UNITS[u]}";
    }

    /** Multi-dot and single-dot abbreviations. */
    private static readonly IReadOnlyDictionary<string, string> DOTTED = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["π.Χ."] = "προ Χριστού",
        ["μ.Χ."] = "μετά Χριστόν",
        ["π.χ."] = "παραδείγματος χάριν",
        ["π.μ."] = "προ μεσημβρίας",
        ["μ.μ."] = "μετά μεσημβρίας",
        ["κ.λπ."] = "και λοιπά",
        ["κ.ά."] = "και άλλα",
    };

    private static readonly JsRe DOT_ESCAPE = JsRegex.Compile("\\.", "gu");
    private static readonly string DOTTED_ALT = string.Join("|", DOTTED.Keys
        .OrderByDescending(k => k.Length)
        .Select(k => DOT_ESCAPE.Replace(k, "\\.")));

    /** symbol normalization — Greek. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Ampersand = "και",
        Multiply = new MultiplyDef { Times = "επί" },
        Percent = new[] { "τοις εκατό" }, // invariant
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["$"] = new[] { "δολάριο", "δολάρια" },
            ["€"] = new[] { "ευρώ" }, // indeclinable in Greek
            ["£"] = new[] { "λίρα", "λίρες" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "χιλιόμετρο", "χιλιόμετρα" },
            ["m"] = new[] { "μέτρο", "μέτρα" },
            ["cm"] = new[] { "εκατοστό", "εκατοστά" },
            ["mm"] = new[] { "χιλιοστό", "χιλιοστά" },
            ["kg"] = new[] { "κιλό", "κιλά" },
            ["g"] = new[] { "γραμμάριο", "γραμμάρια" },
            ["mi"] = new[] { "μίλι", "μίλια" },
        },
        Magnitudes = new[] { "χιλιάδες", "εκατομμύρια", "εκατομμύριο", "δισεκατομμύρια", "δισεκατομμύριο" },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "τετραγωνικό", "τετραγωνικά" },
            Cubed = new[] { "κυβικό", "κυβικά" },
            Position = ExponentPosition.Before,
        },
    });

    /** Inflect one masculine-nominative ordinal to the case/gender the written ending marks. */
    private static string Inflect(string bas, string written)
    {
        var forms = ORD_ENDING[written];
        var oxytone = bas.EndsWith("ός", StringComparison.Ordinal);
        return bas[..^2] + forms[oxytone ? 1 : 0];
    }

    /** n → the ordinal's masculine-nominative WORDS. */
    private static string[]? OrdinalParts(double n)
    {
        if (n < 1 || n > 100 || !double.IsInteger(n)) return null;
        if (n == 100) return new[] { "εκατοστός" };
        if (n <= 12) return new[] { ORD_UNITS[(int)n] };
        if (n < 20) return new[] { "δέκατος", ORD_UNITS[(int)n - 10] };
        var t = (int)Math.Floor(n / 10);
        var u = (int)(n % 10);
        return u == 0 ? new[] { ORD_TENS[t] } : new[] { ORD_TENS[t], ORD_UNITS[u] };
    }

    /** n → the ordinal inflected to `written` ("15","ο" → «δέκατο πέμπτο»), or null if out of range. */
    private static string? Ordinal(double n, string written)
    {
        var parts = OrdinalParts(n);
        return parts is null ? null : string.Join(" ", parts.Select(p => Inflect(p, written)));
    }

    /** A run of Greek alphabetic-numeral signs → its value, or null if any sign is unknown. */
    private static double? GreekNumeralValue(string run)
    {
        double total = 0;
        var i = 0;
        while (i < run.Length)
        {
            var two = i + 2 <= run.Length ? run[i..(i + 2)] : "";
            if (two.Length == 2 && GREEK_NUMERAL.TryGetValue(two, out var tv))
            {
                total += tv;
                i += 2;
                continue;
            }
            if (!GREEK_NUMERAL.TryGetValue(run[i].ToString(), out var v)) return null;
            total += v;
            i++;
        }
        return total == 0 ? null : total;
    }

    /** One all-caps Latin run → its word reading if it has one, else its Greek letter names, spaced. */
    private static string SpellLatin(string run)
    {
        if (WORD_ACRONYM.TryGetValue(run, out var word)) return word;
        var names = new List<string>();
        foreach (var ch in Js.CodePoints(run))
        {
            if (!LETTER_NAME.TryGetValue(ch.ToLowerInvariant(), out var n)) return run; // not spellable ⇒ leave it for the foreign fallback
            names.Add(n);
        }
        return string.Join(" ", names);
    }

    // ── compiled patterns (the TS builds several of these per call with `new RegExp`) ───────────────────
    private static readonly JsRe ANO_TELEIA = JsRegex.Compile("\\u0387", "gu");
    private static readonly JsRe LATIN_TOUCHING_GREEK = JsRegex.Compile(
        "(?<=\\p{Script=Greek})[A-Za-z]+|[A-Za-z]+(?=\\p{Script=Greek})", "gu");
    private static readonly JsRe BARE_O = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d'’-])o(?![\\p{L}\\p{M}\\d'’-])", "gu");
    private static readonly JsRe SENTENCE_INITIAL_HO = JsRegex.Compile("(^|[.!;·…»]\\s+)([HO])(?=\\s+\\p{Script=Greek})", "gu");
    private static readonly JsRe GREEK_NUMERAL_RE = JsRegex.Compile("(?<![\\p{L}\\p{M}])([Α-ΩϚ]{1,4})[΄ʹʹ](?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DOTTED_RE = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}])({DOTTED_ALT})(\\s*[,;:!?)\\]»·]|\\s+\\p{{Ll}}|)", "gu");
    private static readonly JsRe VLEPE = JsRegex.Compile("(?<![\\p{L}\\p{M}])βλ\\.(?=\\s+\\p{Ll})", "gu");
    private static readonly JsRe RATE_KM_H = JsRegex.Compile("(\\d)\\s?(?:km|χλμ)\\s?\\/\\s?(?:h|ώρα)(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe RATE_MI_H = JsRegex.Compile("(\\d)\\s?(?:mi|μίλια)\\s?\\/\\s?(?:h|ώρα)(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe RATE_MPH = JsRegex.Compile("(\\d)\\s?mph(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe RATE_M_S = JsRegex.Compile("(\\d)\\s?m\\s?\\/\\s?s(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe XLM_DOT = JsRegex.Compile("(?<![\\p{L}\\p{M}])χλμ\\.(?=\\s+\\p{Ll})", "gu");
    private static readonly JsRe XLM = JsRegex.Compile("(?<![\\p{L}\\p{M}])χλμ(?![\\p{L}\\p{M}.])", "gu");
    private static readonly JsRe DEGROUP = JsRegex.Compile("(\\d)\\.(\\d{3})(?!\\d)", "gu");
    private static readonly JsRe ORDINAL_RE = JsRegex.Compile(
        $"(?<![\\p{{L}}\\p{{M}}\\d])(\\d{{1,3}})({ORD_ALT})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(?<![\\d:.,])([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:])(?![.,]\\d)", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?°\\s?F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d)\\s?°", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d])\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe HALF = JsRegex.Compile("(\\d)\\s?½", "gu");
    private static readonly JsRe QUARTER = JsRegex.Compile("(\\d)\\s?¼", "gu");
    private static readonly JsRe THREE_QUARTERS = JsRegex.Compile("(\\d)\\s?¾", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("\\s?<\\s?", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("\\s?>\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe PARENTHETICAL_DASH = JsRegex.Compile("(?<=\\S)(?:\\s+[–—]\\s*|[–—]\\s+)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}\\p{Nd}])(?<!\\p{Nd}[\\p{L}\\p{M}]{0,2}[.,]?[ \\t]?)[-−](?=\\p{Nd})", "gu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(\\d),(?=\\d)", "gu");
    private static readonly List<(JsRe Re, string Word)> MIXED_CASE_RES = MIXED_CASE_INITIALISM
        .Select(kv => (JsRegex.Compile($"(?<![\\p{{Script=Latin}}\\d]){kv.Key}(?![\\p{{Script=Latin}}\\d])", "gu"), kv.Value))
        .ToList();
    private static readonly JsRe CAPS_RUN = JsRegex.Compile("(?<![\\p{Script=Latin}\\d'’])[A-Z]{2,}(?![\\p{Script=Latin}\\d'’])", "gu");
    private static readonly JsRe SINGLE_LATIN = JsRegex.Compile("(?<![\\p{Script=Latin}\\d'’&])[A-Za-z](?![\\p{Script=Latin}\\d'’&])", "gu");

    /** Normalize one Modern Greek input string. Pure text→text. */
    public static string NormalizeGreek(string input)
    {
        var s = input;

        s = ANO_TELEIA.Replace(s, "·");

        s = LATIN_TOUCHING_GREEK.Replace(s, m =>
            string.Concat(Js.CodePoints(m.Value).Select(c => HOMOGLYPH.TryGetValue(c, out var g) ? g : c)));
        s = BARE_O.Replace(s, "ο");
        s = SENTENCE_INITIAL_HO.Replace(s, m => m.Groups[1].Value + HOMOGLYPH[m.Groups[2].Value]);

        s = GREEK_NUMERAL_RE.Replace(s, m =>
        {
            var v = GreekNumeralValue(m.Groups[1].Value);
            if (v is null) return m.Value;
            return Ordinal(v.Value, "ο") ?? m.Value;
        });

        s = DOTTED_RE.Replace(s, m =>
        {
            var after = m.Groups[2].Value;
            return $"{DOTTED[m.Groups[1].Value]}{(after == "" ? "." : after)}";
        });

        s = VLEPE.Replace(s, "βλέπε");

        s = RATE_KM_H.Replace(s, "$1 χιλιόμετρα την ώρα");
        s = RATE_MI_H.Replace(s, "$1 μίλια την ώρα");
        s = RATE_MPH.Replace(s, "$1 μίλια την ώρα");
        s = RATE_M_S.Replace(s, "$1 μέτρα το δευτερόλεπτο");

        s = XLM_DOT.Replace(s, "χιλιόμετρα");
        s = XLM.Replace(s, "χιλιόμετρα");

        // DIGIT DE-GROUPING, first among the number rules: Greek groups thousands with a PERIOD. Run twice
        // for `5.000.000`. ⚠ Only a block of EXACTLY three digits is grouping, so a sports time is intact.
        for (var k = 0; k < 2; k++) s = DEGROUP.Replace(s, "$1$2");

        s = ORDINAL_RE.Replace(s, m => Ordinal(Js.Number(m.Groups[1].Value), m.Groups[2].Value) ?? m.Value);

        // CLOCK. Hours are FEMININE (they count ώρες), minutes neuter; a whole hour drops the minutes.
        // ⚠ Guarded against a sports time, which is minutes plus decimal seconds in the same shape.
        s = CLOCK.Replace(s, m =>
        {
            var hv = Js.Number(m.Groups[1].Value);
            var mv = Js.Number(m.Groups[2].Value);
            return mv == 0 ? HOUR_FEM[(int)hv] : $"{HOUR_FEM[(int)hv]} και {MinuteWords(mv)}";
        });

        s = DEG_C.Replace(s, "$1 βαθμοί Κελσίου");
        s = DEG_F.Replace(s, "$1 βαθμοί Φαρενάιτ");
        s = DEG.Replace(s, "$1 βαθμοί");

        s = PLUS_MINUS.Replace(s, " συν μείον ");
        s = PLUS.Replace(s, "συν ");
        s = HALF.Replace(s, "$1 και μισή");
        s = QUARTER.Replace(s, "$1 και ένα τέταρτο");
        s = THREE_QUARTERS.Replace(s, "$1 και τρία τέταρτα");

        s = EQUALS.Replace(s, " ίσον ");
        s = LESS_THAN.Replace(s, " μικρότερο από ");
        s = GREATER_THAN.Replace(s, " μεγαλύτερο από ");
        s = DIVIDE.Replace(s, " διά ");

        s = PARENTHETICAL_DASH.Replace(s, ", ");

        s = MINUS.Replace(s, "μείον ");

        s = SYMBOLS(s);

        s = DECIMAL_COMMA.Replace(s, "$1 κόμμα ");

        foreach (var (re, v) in MIXED_CASE_RES) s = re.Replace(s, v);
        s = CAPS_RUN.Replace(s, m => SpellLatin(m.Value));
        s = SINGLE_LATIN.Replace(s, m => SpellLatin(m.Value));

        return s;
    }
}

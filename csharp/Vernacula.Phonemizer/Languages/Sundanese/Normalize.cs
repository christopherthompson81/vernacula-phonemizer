/**
 * Sundanese (su) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/sundanese/normalize.ts — see that file for the corpus evidence, for why the
 * steps are ORDER-DEPENDENT, and for the separator-convention analysis the de-grouping arms rest on.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Sundanese;

public static class Normalize
{
    /** The shared symbol tier. Sundanese has NO nominal plural, so every CountForms is a single entry. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "persén" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["US$"] = new[] { "dolar Amérika" },
            ["AS$"] = new[] { "dolar Amérika" },
            ["$"] = new[] { "dolar" },
            ["Rp"] = new[] { "rupiah" },
            ["€"] = new[] { "euro" },
            ["£"] = new[] { "poundstérling" },
        },
        Magnitudes = new[] { "rébu", "rebu", "juta", "yuta", "milyar", "miliar", "triliun" },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilométer" },
            ["m"] = new[] { "méter" },
            ["cm"] = new[] { "séntiméter" },
            ["mm"] = new[] { "miliméter" },
            ["kg"] = new[] { "kilogram" },
            ["g"] = new[] { "gram" },
            ["gr"] = new[] { "gram" },
            ["mg"] = new[] { "miligram" },
            ["pm"] = new[] { "pikométer" },
            ["ha"] = new[] { "héktar" },
            ["l"] = new[] { "liter" },
        },
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["jam"] = "jam", ["detik"] = "detik", ["h"] = "jam", ["s"] = "detik",
        },
        UnitPer = "per",
        ExponentWords = new ExponentWordsDef { Squared = new[] { "pasagi" }, Cubed = new[] { "kubik" } },
        // ⚠ THESE ARE TEMPLATES, NOT WORDS — `{n}` is the base and `{e}` the exponent.
        BareExponent = new BareExponentDef
        {
            Squared = "{n} pasagi", Cubed = "{n} kubik", Power = "{n} pangkat {e}", Negative = "kurang",
        },
        Ampersand = "jeung",
        Multiply = new MultiplyDef { Times = "kali" },
    });

    /** Unit abbreviation → its Sundanese noun, for the two RATE shapes the shared tier cannot reach. */
    private static readonly IReadOnlyDictionary<string, string> UNIT_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km"] = "kilométer", ["m"] = "méter", ["cm"] = "séntiméter", ["mm"] = "miliméter",
        ["kg"] = "kilogram", ["g"] = "gram", ["ha"] = "héktar", ["l"] = "liter", ["c"] = "c",
    };

    private static readonly IReadOnlyDictionary<string, string> EXP_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        [""] = "", ["²"] = " pasagi", ["³"] = " kubik",
    };

    /** …and the ASCII spellings of the same two powers, folded to the superscript before lookup. */
    private static readonly IReadOnlyDictionary<string, string> EXP_ASCII = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["2"] = "²", ["3"] = "³",
    };


    /** Compass points for the COORDINATE sense of `°`, keyed lowercase — the rule matches case-insensitively. */
    private static readonly IReadOnlyDictionary<string, string> COMPASS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["n"] = "kalér", ["s"] = "kidul", ["e"] = "wétan", ["w"] = "kulon",
    };

    private static readonly JsRe LATEX_MATH =
        JsRegex.Compile("\\$([^$]*[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+[^$]*)\\$", "gu");
    private static readonly JsRe GROUP_DOT =
        JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2}(?:\\.\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe GROUP_COMMA =
        JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2}(?:,\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe GROUP_SPACE =
        JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2}(?:[ \\u00a0\\u202f\\u2009]\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe GROUP_SPACE_CHARS = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");
    private static readonly JsRe CLOCK_WORD = JsRegex.Compile(
        "(?<![\\d.:])\\b(jam|tabuh|pukul)\\s?([01]?\\d|2[0-3])[.:]([0-5]\\d)\\b(?!\\.?\\d)", "giu");
    private static readonly JsRe CLOCK_BARE = JsRegex.Compile(
        "(?<![\\d.:])([01]?\\d|2[0-3]):([0-5]\\d)\\b(?!\\.?\\d)", "gu");
    private static readonly JsRe SLASH_UNIT = JsRegex.Compile(
        "(?<=[\\p{L}\\p{M}])\\/(km|m|cm|mm|kg|g|ha|l|c)(²|³|2|3)?(?![\\p{L}\\p{M}\\d])", "giu");
    private static readonly JsRe PER_UNIT = JsRegex.Compile(
        "\\bper\\s+(km|m|cm|mm|kg|g|ha|l)(²|³|2|3)?(?![\\p{L}\\p{M}\\d])", "giu");
    private static readonly JsRe DECIMAL = JsRegex.Compile("(\\d)[.,](\\d{1,2})(?![\\d.,])", "gu");
    private static readonly JsRe ERA_SM = JsRegex.Compile("(\\d+(?:-an)?)\\s*SM\\b(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe ERA_M = JsRegex.Compile("(\\d+(?:-an)?)\\s*M\\b(?![\\p{L}\\p{M}]|\\.\\p{L})", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile(
        "(?<!\\b(?:nepi ka|tepi ka|dugi ka|ti|antara)\\s)(?<![\\d.,\\p{L}-])(\\d+)\\s?[-–]\\s?(\\d+)(?![\\d,-])", "gu");
    /** ⚠ Consecutive four-digit operands are a YEAR SPAN — the only shape the corpus writes with a
     *  slash at that width — and the fraction cap below declined them and dropped the slash. */
    private static readonly JsRe YEAR_SPAN = JsRegex.Compile("(?<![\\d/])(\\d{4})\\/(\\d{4})(?![\\d/])", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d/])(\\d{1,3})\\/(\\d{1,3})(?![\\d/])", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?°\\s?F(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_COMPASS = JsRegex.Compile("(\\d)\\s?°\\s?([NSEW])(?![\\p{L}\\p{M}])", "giu");
    /** ⚠ Spaced off from a following letter first — the scale arms decline `25°Cölner` and this one
     *  then produced `25 darajatCölner`, one fused token. */
    private static readonly JsRe DEG_BARE_GLUED = JsRegex.Compile("(\\d)\\s?°(?=[\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d)\\s?°", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS_AFTER = JsRegex.Compile("(\\S)\\+\\s?(\\(?\\s?[-−]?\\d)", "gu");
    private static readonly JsRe PLUS_LEAD = JsRegex.Compile("(^|\\s)\\+\\s?(\\(?\\s?[-−]?\\d)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|[\\s(])[-−–](\\d)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("\\s?<\\s?", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("\\s?>\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");

    /** Every rule emits DIGITS where a number is involved and lets the engine's own number path speak them. */
    public static string NormalizeSundanese(string input)
    {
        var s = input;

        // 0. LaTeX math delimiters — before ANY rule reads `$` as money.
        s = LATEX_MATH.Replace(s, "$1");

        // 1. De-group thousands — FIRST, and by GROUP SIZE, which is the whole disambiguation.
        s = GROUP_DOT.Replace(s, m => m.Value.Replace(".", "", StringComparison.Ordinal));
        s = GROUP_COMMA.Replace(s, m => m.Value.Replace(",", "", StringComparison.Ordinal));
        s = GROUP_SPACE.Replace(s, m => GROUP_SPACE_CHARS.Replace(m.Value, ""));

        // 2. Clock — BEFORE the decimal rule, which would otherwise claim `7.30`.
        s = CLOCK_WORD.Replace(s, m =>
        {
            var w = m.Groups[1].Value;
            var h = Js.NumberToString(Js.Number(m.Groups[2].Value));
            var min = Js.Number(m.Groups[3].Value);
            return min == 0 ? $"{w} {h}" : $"{w} {h} liwat {Js.NumberToString(min)}";
        });
        s = CLOCK_BARE.Replace(s, m =>
        {
            var h = Js.NumberToString(Js.Number(m.Groups[1].Value));
            var min = Js.Number(m.Groups[2].Value);
            return min == 0 ? $"jam {h}" : $"jam {h} liwat {Js.NumberToString(min)}";
        });

        // 3. Unit after the word `per` (and the slash rate whose numerator is a word) — BEFORE the tier.
        s = SLASH_UNIT.Replace(s, m =>
        {
            var u = m.Groups[1].Value;
            var exp0 = m.Groups[2].Success ? m.Groups[2].Value : "";
            var exp = EXP_ASCII.TryGetValue(exp0, out var sup) ? sup : exp0;
            var word = UNIT_WORD.TryGetValue(Js.ToLowerCase(u), out var uw) ? uw : u;
            return $" per {word}{(EXP_WORD.TryGetValue(exp, out var ew) ? ew : "")}";
        });
        s = PER_UNIT.Replace(s, m =>
        {
            var exp0 = m.Groups[2].Success ? m.Groups[2].Value : "";
            var exp = EXP_ASCII.TryGetValue(exp0, out var sup) ? sup : exp0;
            return $"per {UNIT_WORD[Js.ToLowerCase(m.Groups[1].Value)]}{(EXP_WORD.TryGetValue(exp, out var ew) ? ew : "")}";
        });

        // 4. The shared tier — BEFORE the decimal rule (units before decimals), AFTER de-grouping.
        s = SYMBOLS(s);

        // 5. Decimals → `koma`, read digit-by-digit after the separator.
        s = DECIMAL.Replace(s, m =>
            $"{m.Groups[1].Value} koma {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        // 6. Era markers — SM before M, always.
        s = ERA_SM.Replace(s, "$1 saméméh Maséhi");
        s = ERA_M.Replace(s, "$1 Maséhi");

        // 7. Ranges → `nepi ka`.
        s = RANGE.Replace(s, "$1 nepi ka $2");

        // 8. Fractions.
        s = YEAR_SPAN.Replace(s, m => Js.Number(m.Groups[2].Value) == Js.Number(m.Groups[1].Value) + 1
            ? $"{m.Groups[1].Value} nepi ka {m.Groups[2].Value}"
            : m.Value);
        s = FRACTION.Replace(s, m =>
            Js.Number(m.Groups[1].Value) == 1 && Js.Number(m.Groups[2].Value) == 2
                ? "satengah"
                : $"{m.Groups[1].Value} per {m.Groups[2].Value}");

        // 9. Degrees — scale letters, then compass, then the bare sign.
        s = DEG_C.Replace(s, "$1 darajat Celsius");
        s = DEG_F.Replace(s, "$1 darajat Fahrenheit");
        s = DEG_COMPASS.Replace(s, m =>
            // ⚠ REFUSE THE WHOLE MATCH ON AN UNKNOWN DIRECTION (#1122). The pattern carries `i` AND `u`, so
            // JS folds U+017F LONG S onto `s` and `12°ſ` MATCHES `[NSEW]` — while `ſ` is no COMPASS key. The
            // TS asserted non-null and spoke the word "undefined"; the C# indexer THREW.
            COMPASS.TryGetValue(Js.ToLowerCase(m.Groups[2].Value), out var dir)
                ? $"{m.Groups[1].Value} darajat {dir}"
                : m.Value);
        s = DEG_BARE_GLUED.Replace(s, "$1 darajat ");
        s = DEG_BARE.Replace(s, "$1 darajat");

        // 10. Signs. ⚠ MINUS AFTER PLUS — the order is forced by the bracketed operand.
        s = PLUS_MINUS.Replace(s, " tambah kurang ");
        s = PLUS_AFTER.Replace(s, "$1 tambah $2");
        s = PLUS_LEAD.Replace(s, "$1tambah $2");
        s = MINUS.Replace(s, "$1kurang $2");
        s = EQUALS.Replace(s, " sarua jeung ");
        s = LESS_THAN.Replace(s, " leuwih leutik ti ");
        s = GREATER_THAN.Replace(s, " leuwih gedé ti ");
        s = DIVIDE.Replace(s, " dibagi ");

        return s;
    }
}

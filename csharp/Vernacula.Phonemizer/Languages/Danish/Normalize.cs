/**
 * Danish (da) text normalization — the pre-tokenizer pass rewriting everything the Danish g2p cannot read
 * into Danish words. Pure text→text, no IPA.
 * Ported from src/languages/danish/normalize.ts — see that file for the ordered steps, the corpus counts,
 * and in particular for why Danish is NOT Norwegian (the period is a thousands separator here).
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Danish;

public static class Normalize
{
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Multiply = new MultiplyDef { Times = "gange" },
        Percent = new[] { "procent" },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "kilometer" },
            ["m"] = new[] { "meter" },
        },
        UnitPer = "i",
        RateDenominators = new Dictionary<string, string>
        {
            ["t"] = "timen", ["h"] = "timen", ["s"] = "sekundet",
        },
    });

    private static IReadOnlyDictionary<string, string> ORDINALS => Manifest.MANIFEST.Ordinals;

    /** Dotted abbreviations (84 in the corpus). The dot is CONSUMED. */
    private static readonly (JsRe Re, string Word)[] ABBREV =
    [
        (JsRegex.Compile("\\bkl\\.", "giu"), "klokken"),
        (JsRegex.Compile("\\bbl\\.a\\.", "giu"), "blandt andet"),
        (JsRegex.Compile("\\bf\\.eks\\.", "giu"), "for eksempel"),
        (JsRegex.Compile("\\bdvs\\.", "giu"), "det vil sige"),
        (JsRegex.Compile("\\bosv\\.", "giu"), "og så videre"),
        (JsRegex.Compile("\\bnr\\.", "giu"), "nummer"),
        (JsRegex.Compile("\\bdr\\.", "giu"), "doktor"),
    ];

    /** Squared / cubed units. Danish compounds them into ONE word, modifier first. */
    private static readonly (JsRe Re, string Word)[] SQUARED =
    [
        (JsRegex.Compile("\\bkm\\s*²", "giu"), "kvadratkilometer"),
        (JsRegex.Compile("\\bm\\s*²", "giu"), "kvadratmeter"),
        (JsRegex.Compile("\\bcm\\s*²", "giu"), "kvadratcentimeter"),
        (JsRegex.Compile("\\bm\\s*³", "giu"), "kubikmeter"),
    ];

    /** Currency SIGN → the Danish word. ⚠ INSERTION-ORDERED like JS `Object.entries` — the three arms per
     *  sign run in this order, and a Dictionary preserves it as long as nothing is removed. */
    private static readonly IReadOnlyDictionary<string, string> CURRENCY = new Dictionary<string, string>
    {
        ["$"] = "dollar", ["€"] = "euro", ["£"] = "pund", ["¥"] = "yen",
    };

    /** Relational and operator signs, read in every position. */
    private static readonly (JsRe Re, string Word)[] RELATIONAL =
    [
        (JsRegex.Compile("±", "gu"), " plus minus "),
        (JsRegex.Compile("≈", "gu"), " cirka lig med "),
        (JsRegex.Compile("≤", "gu"), " mindre end eller lig med "),
        (JsRegex.Compile("≥", "gu"), " større end eller lig med "),
        (JsRegex.Compile("=", "gu"), " lig med "),
        (JsRegex.Compile("<", "gu"), " mindre end "),
        (JsRegex.Compile(">", "gu"), " større end "),
        (JsRegex.Compile("×", "gu"), " gange "),
        (JsRegex.Compile("÷", "gu"), " divideret med "),
    ];

    private static readonly JsRe GROUPED_THOUSANDS =
        JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0)\\.(?=\\d{3}(?!\\d))", "gu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(\\d+),(\\d+)", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(\\d{1,2}):(\\d{2})(?!\\d)", "gu");
    private static readonly JsRe PERCENT = JsRegex.Compile("(\\d+)\\s*%", "gu");
    private static readonly JsRe DEG_C_SIGN = JsRegex.Compile("℃", "gu");
    private static readonly JsRe DEG_F_SIGN = JsRegex.Compile("℉", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s*°\\s*C(?![\\p{L}])", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s*°\\s*F(?![\\p{L}])", "giu");
    private static readonly JsRe DEG_GLUED = JsRegex.Compile("(\\d)\\s*°(?=[\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d)\\s*°", "gu");
    private static readonly JsRe ORDINAL_RANGE =
        JsRegex.Compile("(?<!\\d)(\\d{1,2})\\.\\s*[-–—]\\s*(\\d{1,2})\\.(?=\\s+\\p{Ll})", "gu");
    private static readonly JsRe ORDINAL_PAIR =
        JsRegex.Compile("(?<!\\d)(\\d{1,2})\\.\\s+(og|eller)\\s+(\\d{1,2})\\.", "gu");
    private static readonly JsRe ORDINAL_DOT = JsRegex.Compile("(?<!\\d)(\\d{1,2})\\.(?=\\s+\\p{Ll})", "gu");
    private static readonly JsRe RANGE =
        JsRegex.Compile("(?<![-–—])(\\d+)\\s*[-–—]\\s*(\\d+)(?!\\d)(?!\\s*[-–—]\\s*\\d)", "gu");
    private static readonly JsRe CURRENCY_CODE = JsRegex.Compile("\\b([A-Z]{2,3})\\s*\\$", "gu");
    private static readonly JsRe SIGNED = JsRegex.Compile("(?<![\\p{L}\\d])([-−+])(\\d+)", "gu");
    private static readonly JsRe INFIX_PLUS = JsRegex.Compile("(\\d)\\s*\\+\\s*(\\d)", "gu");
    private static readonly JsRe AMPERSAND = JsRegex.Compile("\\s*[&＆]\\s*", "gu");
    private static readonly JsRe SPACE_RUN = JsRegex.Compile("[ \\t]{2,}", "gu");
    private static readonly JsRe ESCAPE = JsRegex.Compile("[.*+?^${}()|[\\]\\\\]", "gu");

    /** The three per-sign currency arms, compiled once per sign (the TS builds them per call). */
    private sealed record CurrencyArms(JsRe Postposed, JsRe PreposedGlued, JsRe Preposed, string Word);

    private static readonly IReadOnlyList<CurrencyArms> CURRENCY_ARMS = CURRENCY
        .Select(kv =>
        {
            var esc = ESCAPE.Replace(kv.Key, "\\$&");
            return new CurrencyArms(
                JsRegex.Compile($"(\\d+)\\s*{esc}", "gu"),
                JsRegex.Compile($"{esc}\\s*(\\d+)(?=[\\p{{L}}\\p{{M}}])", "gu"),
                JsRegex.Compile($"{esc}\\s*(\\d+)", "gu"),
                kv.Value);
        })
        .ToList();

    public static string NormalizeDanish(string input)
    {
        var t = input;

        // 1) PERIOD-GROUPED THOUSANDS, first — before anything reads a bare number.
        string prev;
        do
        {
            prev = t;
            t = Rewrite(t, GROUPED_THOUSANDS, "");
        } while (t != prev);

        // 2) DECIMAL COMMA. Fractional part spoken digit by digit.
        t = Rewrite(t, DECIMAL_COMMA, m =>
            $"{m.Groups[1].Value} komma {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        // 3) CLOCK, COLON FORM ONLY.
        t = Rewrite(t, CLOCK, "$1 $2");

        // 4) ABBREVIATIONS, dot consumed.
        foreach (var (re, word) in ABBREV) t = Rewrite(t, re, word);

        // 5) PERCENT.
        t = Rewrite(t, PERCENT, "$1 procent");

        // 6) DEGREES, BEFORE the unit rules.
        t = Rewrite(Rewrite(t, DEG_C_SIGN, "°C"), DEG_F_SIGN, "°F");
        t = Rewrite(t, DEG_C, "$1 grader celsius");
        t = Rewrite(t, DEG_F, "$1 grader fahrenheit");
        // ⚠ The trailing space keeps the noun off the following letter run (`35°V` → *ɡʁˈaðeʁv*); emitted
        // only when a letter actually follows, and the space-run tidy below collapses it.
        t = Rewrite(t, DEG_GLUED, "$1 grader ");
        t = Rewrite(t, DEG_BARE, "$1 grader");

        // 7) SQUARED / CUBED UNITS.
        foreach (var (re, word) in SQUARED) t = Rewrite(t, re, word);

        // 8) ORDINAL RANGES — before the ordinal-dot rule and before the cardinal range rule.
        t = Rewrite(t, ORDINAL_RANGE, m =>
        {
            var first = Lookup(ORDINALS, Js.NumberToString(Js.Number(m.Groups[1].Value)));
            var second = Lookup(ORDINALS, Js.NumberToString(Js.Number(m.Groups[2].Value)));
            return first is not null && second is not null ? $"{first} til {second}" : m.Value;
        });

        // 9) COORDINATED ORDINALS — a coordinator between two dotted numbers makes both ordinals.
        t = Rewrite(t, ORDINAL_PAIR, m =>
        {
            var first = Lookup(ORDINALS, m.Groups[1].Value);
            var second = Lookup(ORDINALS, m.Groups[3].Value);
            return first is not null && second is not null
                ? $"{first} {m.Groups[2].Value} {second}"
                : m.Value;
        });

        // 10) ORDINAL DOT — the following-lowercase guard separates it from a sentence ending in a year.
        t = Rewrite(t, ORDINAL_DOT, m => Lookup(ORDINALS, m.Groups[1].Value) ?? m.Value);

        // 11) RANGES.
        t = Rewrite(t, RANGE, "$1 til $2");

        // 12) CURRENCY, in BOTH positions.
        t = Rewrite(t, CURRENCY_CODE, "$1 dollar");
        foreach (var arms in CURRENCY_ARMS)
        {
            t = Rewrite(t, arms.Postposed, $"$1 {arms.Word}");
            // ⚠ The trailing space keeps the noun from fusing with an abbreviated magnitude glued to the
            // number (`$110m` → *dˈolaʁm*); emitted only when a letter actually follows.
            t = Rewrite(t, arms.PreposedGlued, $"$1 {arms.Word} ");
            t = Rewrite(t, arms.Preposed, $"$1 {arms.Word}");
        }

        // 13) SIGNED NUMBERS.
        t = Rewrite(t, SIGNED, m => $"{(m.Groups[1].Value == "+" ? "plus" : "minus")} {m.Groups[2].Value}");

        // 14) ARITHMETIC AND RELATIONAL SIGNS.
        t = Rewrite(t, INFIX_PLUS, "$1 plus $2");
        foreach (var (re, word) in RELATIONAL) t = Rewrite(t, re, word);

        // 15) AMPERSAND → og.
        t = Rewrite(t, AMPERSAND, " og ");

        t = Rewrite(t, SPACE_RUN, " ");

        // 16) THE SHARED TIER LAST.
        return SYMBOLS(t);
    }

    private static string? Lookup(IReadOnlyDictionary<string, string> map, string key) =>
        map.TryGetValue(key, out var v) ? v : null;
}

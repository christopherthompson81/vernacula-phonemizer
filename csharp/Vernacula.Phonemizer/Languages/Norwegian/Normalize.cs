/**
 * Norwegian Bokmål (nb) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything the Norwegian
 * g2p cannot already read into Norwegian words. Pure text→text, no IPA.
 * Ported from src/languages/norwegian/normalize.ts — see that file for the ordered steps, the corpus counts
 * and the three measured disambiguations.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Norwegian;

public static class Normalize
{
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Multiply = new MultiplyDef { Times = "ganger" },
        Ampersand = "og",
        Percent = new[] { "prosent" },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "kilometer" },
            ["m"] = new[] { "meter" },
            ["mm"] = new[] { "millimeter" },
        },
        UnitPer = "i",
        RateDenominators = new Dictionary<string, string>
        {
            ["t"] = "timen", ["h"] = "timen", ["s"] = "sekundet",
        },
    });

    private static IReadOnlyDictionary<string, string> ORDINALS => Manifest.MANIFEST.Ordinals;

    /** Month names, 1-indexed; index 0 is null so `MONTHS[Number(mo)]` reads as the TS does. */
    private static readonly string?[] MONTHS =
    {
        null, "januar", "februar", "mars", "april", "mai", "juni",
        "juli", "august", "september", "oktober", "november", "desember",
    };

    private static readonly (JsRe Re, string Word)[] ABBREV =
    {
        (JsRegex.Compile("\\bf\\.kr\\.?(?![\\p{L}\\p{M}])", "giu"), "før Kristus"),
        (JsRegex.Compile("\\be\\.kr\\.?(?![\\p{L}\\p{M}])", "giu"), "etter Kristus"),
        (JsRegex.Compile("\\bca\\.", "giu"), "cirka"),
        (JsRegex.Compile("\\bkl\\.", "giu"), "klokka"),
        (JsRegex.Compile("\\bdvs\\.", "giu"), "det vil si"),
        (JsRegex.Compile("\\bbl\\.a\\.", "giu"), "blant annet"),
        (JsRegex.Compile("\\bf\\.eks\\.", "giu"), "for eksempel"),
        (JsRegex.Compile("\\bosv\\.", "giu"), "og så videre"),
        (JsRegex.Compile("\\bnr\\.", "giu"), "nummer"),
        (JsRegex.Compile("\\bdr\\.", "giu"), "doktor"),
        (JsRegex.Compile("\\bjr\\.", "giu"), "junior"),
    };

    /** Currency SIGN → the Norwegian word. ⚠ Insertion-ordered like the TS `Object.entries` loop. */
    private static readonly (string Sign, string Word)[] CURRENCY =
    {
        ("$", "dollar"), ("€", "euro"), ("£", "pund"), ("¥", "yen"),
    };

    private static readonly JsRe[] CURRENCY_RE = CURRENCY
        .Select(c => JsRegex.Compile(
            JsRegex.Compile("[.*+?^${}()|[\\]\\\\]", "gu").Replace(c.Sign, m => "\\" + m.Value)
            + "\\s*(\\d(?:[\\d ]*\\d)?)", "gu"))
        .ToArray();

    private static readonly (JsRe Re, string Word)[] SQUARED =
    {
        (JsRegex.Compile("\\bkm\\s*²", "giu"), "kvadratkilometer"),
        (JsRegex.Compile("\\bm\\s*²", "giu"), "kvadratmeter"),
        (JsRegex.Compile("\\bcm\\s*²", "giu"), "kvadratcentimeter"),
        (JsRegex.Compile("\\bm\\s*³", "giu"), "kubikkmeter"),
    };

    private static readonly (JsRe Re, string Word)[] RELATIONAL =
    {
        (JsRegex.Compile("±", "gu"), " pluss minus "),
        (JsRegex.Compile("≈", "gu"), " omtrent lik "),
        (JsRegex.Compile("≤", "gu"), " mindre enn eller lik "),
        (JsRegex.Compile("≥", "gu"), " større enn eller lik "),
        (JsRegex.Compile("=", "gu"), " er lik "),
        (JsRegex.Compile("<", "gu"), " mindre enn "),
        (JsRegex.Compile(">", "gu"), " større enn "),
        (JsRegex.Compile("×", "gu"), " ganger "),
        (JsRegex.Compile("÷", "gu"), " delt på "),
    };

    private static readonly JsRe SPACE_GROUP =
        // ⚠ separators written as ESCAPES, never as the invisible characters (#931): space, NBSP, NNBSP, thin
        JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0)[ \\u00a0\\u202f\\u2009](?=\\d{3}(?!\\d))", "gu");
    private static readonly JsRe COMMA_GROUP =
        JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0)[,](?=\\d{3}(?!\\d))", "gu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(\\d+),(\\d+)", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(\\d{1,2}):(\\d{2})(?!\\d)", "gu");
    private static readonly JsRe PERCENT = JsRegex.Compile("(\\d+)\\s*%", "gu");
    private static readonly JsRe DEG_C_SIGN = JsRegex.Compile("℃", "gu");
    private static readonly JsRe DEG_F_SIGN = JsRegex.Compile("℉", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s*°\\s*C(?![\\p{L}])", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s*°\\s*F(?![\\p{L}])", "giu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d)\\s*°", "gu");
    private static readonly JsRe NUMERIC_DATE =
        JsRegex.Compile("(?<!\\d)(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4})(?!\\d)", "gu");
    private static readonly JsRe ORDINAL_RANGE =
        JsRegex.Compile("(?<!\\d)(\\d{1,2})\\.\\s*[-–—]\\s*(\\d{1,2})\\.(?=\\s+\\p{Ll})", "gu");
    private static readonly JsRe ORDINAL_DOT = JsRegex.Compile("(?<!\\d)(\\d{1,2})\\.(?=\\s+\\p{Ll})", "gu");
    private static readonly JsRe RANGE =
        JsRegex.Compile("(?<![-–—])(\\d+)\\s*[-–—]\\s*(\\d+)(?!\\d)(?!\\s*[-–—]\\s*\\d)", "gu");
    private static readonly JsRe SIGNED = JsRegex.Compile("(?<![\\p{L}\\d])([-−+])(\\d+)", "gu");
    private static readonly JsRe INFIX_PLUS = JsRegex.Compile("(\\d)\\s*\\+\\s*(\\d)", "gu");
    private static readonly JsRe SPACE_RUN = JsRegex.Compile("[ \\t]{2,}", "gu");

    public static string NormalizeNorwegian(string input)
    {
        var t = input;

        // 1) SPACE-GROUPED THOUSANDS, FIRST.
        string prev;
        do
        {
            prev = t;
            t = Rewrite(t, SPACE_GROUP, _ => "");
        } while (t != prev);

        // 2) ENGLISH-STYLE COMMA GROUPING — before the decimal rule.
        do
        {
            prev = t;
            t = Rewrite(t, COMMA_GROUP, _ => "");
        } while (t != prev);

        // 3) DECIMAL COMMA; the fractional part is spoken digit by digit.
        t = Rewrite(t, DECIMAL_COMMA, m =>
            $"{m.Groups[1].Value} komma {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        // 4) CLOCK, COLON FORM ONLY.
        t = Rewrite(t, CLOCK, m => $"{m.Groups[1].Value} {m.Groups[2].Value}");

        // 5) ABBREVIATIONS, dot consumed.
        foreach (var (re, word) in ABBREV) t = Rewrite(t, re, _ => word);

        // 6) PERCENT.
        t = Rewrite(t, PERCENT, m => $"{m.Groups[1].Value} prosent");

        // 7) DEGREES, BEFORE the unit rules.
        t = Rewrite(t, DEG_C_SIGN, _ => "°C");
        t = Rewrite(t, DEG_F_SIGN, _ => "°F");
        t = Rewrite(t, DEG_C, m => $"{m.Groups[1].Value} grader celsius");
        t = Rewrite(t, DEG_F, m => $"{m.Groups[1].Value} grader fahrenheit");
        t = Rewrite(t, DEG_BARE, m => $"{m.Groups[1].Value} grader");

        // 8) SQUARED / CUBED UNITS.
        foreach (var (re, word) in SQUARED) t = Rewrite(t, re, _ => word);

        // 9) NUMERIC DATES `D.M.YYYY`, before the ordinal-dot rule.
        t = Rewrite(t, NUMERIC_DATE, m =>
        {
            var day = ORDINALS.TryGetValue(Js.NumberToString(Js.Number(m.Groups[1].Value)), out var d) ? d : null;
            var moIdx = Js.Number(m.Groups[2].Value);
            var month = moIdx >= 0 && moIdx < MONTHS.Length && moIdx == Math.Floor(moIdx)
                ? MONTHS[(int)moIdx]
                : null;
            return day is not null && month is not null
                ? $"{day} {month} {m.Groups[3].Value}"
                : m.Value;
        });

        // 10) ORDINAL RANGES, before the ordinal-dot and cardinal-range rules.
        t = Rewrite(t, ORDINAL_RANGE, m =>
        {
            var first = ORDINALS.TryGetValue(Js.NumberToString(Js.Number(m.Groups[1].Value)), out var a) ? a : null;
            var second = ORDINALS.TryGetValue(Js.NumberToString(Js.Number(m.Groups[2].Value)), out var b) ? b : null;
            return first is not null && second is not null ? $"{first} til {second}" : m.Value;
        });

        // 11) ORDINAL DOT — the largest defect in the language.
        // ⚠ The key is the RAW digits, not `String(Number(n))` as in steps 9/10 — so `03.` declines.
        t = Rewrite(t, ORDINAL_DOT, m =>
            ORDINALS.TryGetValue(m.Groups[1].Value, out var o) ? o : m.Value);

        // 12) RANGES.
        t = Rewrite(t, RANGE, m => $"{m.Groups[1].Value} til {m.Groups[2].Value}");

        // 13) CURRENCY — the sign precedes the amount, the word follows it.
        for (var i = 0; i < CURRENCY.Length; i++)
        {
            var word = CURRENCY[i].Word;
            t = Rewrite(t, CURRENCY_RE[i], m => $"{m.Groups[1].Value} {word}");
        }

        // 14) SIGNED NUMBERS.
        t = Rewrite(t, SIGNED, m =>
            $"{(m.Groups[1].Value == "+" ? "pluss" : "minus")} {m.Groups[2].Value}");

        // 15) ARITHMETIC AND RELATIONAL SIGNS.
        t = Rewrite(t, INFIX_PLUS, m => $"{m.Groups[1].Value} pluss {m.Groups[2].Value}");
        foreach (var (re, word) in RELATIONAL) t = Rewrite(t, re, _ => word);
        t = Rewrite(t, SPACE_RUN, _ => " ");

        // THE SHARED TIER LAST.
        return SYMBOLS(t);
    }
}

/**
 * Sindhi (sd) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything the Sindhi g2p cannot
 * already read into Sindhi words the existing pipeline speaks. Pure text→text, no IPA. Runs inside
 * Sindhi.cs's `Text()`, before the tokenizer.
 * Ported from src/languages/sindhi/normalize.ts — see that file for the corpus evidence and the ordering
 * constraints between the rules.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Sindhi;

public static class Normalize
{
    /** Relational and operator signs, read in every position — a dropped sign is inaudible. */
    private static readonly (JsRe Re, string Word)[] RELATIONAL =
    [
        (JsRegex.Compile("[=≈]", "gu"), " برابر "),
        (JsRegex.Compile("<", "gu"), " کان گهٽ "),
        (JsRegex.Compile(">", "gu"), " کان وڌيڪ "),
        (JsRegex.Compile("×|(?<=\\p{Nd})[ \\t]?x[ \\t]?(?=\\p{Nd})", "gu"), " ڀيرا "),
        (JsRegex.Compile("÷", "gu"), " ورهايل "),
    ];

    /** Currency sign → the Sindhi word. */
    private static readonly IReadOnlyList<KeyValuePair<string, string>> CURRENCY =
    [
        new("$", "ڊالر"), new("€", "يورو"), new("£", "پائونڊ"), new("¥", "ين"), new("₹", "رپيا"),
    ];

    /** Latin unit abbreviations → the Sindhi word. */
    private static readonly (string Source, string Word)[] UNITS =
    [
        ("km", "ڪلوميٽر"),
        ("kg", "ڪلوگرام"),
        ("cm", "سينٽيميٽر"),
        ("mm", "ملي ميٽر"),
    ];

    private static readonly JsRe GROUPED = JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0)[,،](?=\\d{3}(?!\\d))", "gu");
    private static readonly JsRe PERIOD_CLOCK =
        JsRegex.Compile("(\\d{1,2})\\.(\\d{2})(?=\\s*(?:GMT|UTC|وڳي|بجي))", "gu");
    private static readonly JsRe DECIMAL = JsRegex.Compile("(\\d+)\\.(\\d+)", "gu");
    private static readonly JsRe COLON_CLOCK = JsRegex.Compile("(\\d{1,2}):(\\d{2})(?!\\d)", "gu");
    private static readonly JsRe PERCENT_AFTER = JsRegex.Compile("(\\d+)\\s*%", "gu");
    private static readonly JsRe PERCENT_BEFORE = JsRegex.Compile("%\\s*(\\d+)", "gu");
    private static readonly JsRe DEG_C_SIGN = JsRegex.Compile("℃", "gu");
    private static readonly JsRe DEG_F_SIGN = JsRegex.Compile("℉", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s*°\\s*C(?!\\p{L})", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s*°\\s*F(?!\\p{L})", "giu");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d)\\s*°", "gu");
    private static readonly JsRe KM2 = JsRegex.Compile("(?<!\\p{L})km\\s*[²2](?!\\d)", "giu");
    private static readonly JsRe M2 = JsRegex.Compile("(?<!\\p{L})m\\s*[²2](?!\\d)", "giu");
    private static readonly JsRe KM3 = JsRegex.Compile("(?<!\\p{L})km\\s*[³3](?!\\d)", "giu");
    private static readonly JsRe M3 = JsRegex.Compile("(?<!\\p{L})m\\s*[³3](?!\\d)", "giu");
    private static readonly JsRe KMH = JsRegex.Compile("(?<!\\p{L})km\\s*\\/\\s*h(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe MS = JsRegex.Compile("(?<!\\p{L})m\\s*\\/\\s*s(?![\\p{L}\\p{M}])", "giu");

    /** ⚠ `giu`, from the UNITS entries' own declared flags — the TS used to hard-code "gu" here and throw
     *  the `i` away, so `12 KM` read as an initialism. See the TS for the measurement. */
    private static readonly JsRe[] UNIT_RES =
        UNITS.Select(u => JsRegex.Compile($"(\\d)\\s*(?:{u.Source})(?!\\p{{L}})", "giu")).ToArray();

    private static readonly JsRe RANGE =
        JsRegex.Compile("(?<![-–—])(\\d+)\\s*[-–—]\\s*(\\d+)(?!\\d)(?!\\s*[-–—]\\s*\\d)", "gu");

    private static readonly JsRe ESCAPE = JsRegex.Compile("[.*+?^${}()|[\\]\\\\]", "gu");
    private static readonly JsRe[] CURRENCY_BEFORE =
        CURRENCY.Select(c => JsRegex.Compile($"{Esc(c.Key)}\\s*(\\d+)", "gu")).ToArray();
    private static readonly JsRe[] CURRENCY_AFTER =
        CURRENCY.Select(c => JsRegex.Compile($"(\\d+)\\s*{Esc(c.Key)}", "gu")).ToArray();

    private static string Esc(string sign) => JsRegex.Replace(sign, ESCAPE, "\\$&");

    private static readonly JsRe SIGNED = JsRegex.Compile("(?<!\\d)([-−+])(\\d+)", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS = JsRegex.Compile("(\\d)\\s*\\+\\s*(\\d)", "gu");
    private static readonly JsRe AMPERSAND = JsRegex.Compile("\\s*[&＆]\\s*", "gu");
    private static readonly JsRe SPACE_RUN = JsRegex.Compile("[ \\t]{2,}", "gu");

    public static string NormalizeSindhi(string input)
    {
        var t = input;

        // 1) COMMA-GROUPED THOUSANDS, before the decimal rule.
        string prev;
        do
        {
            prev = t;
            t = Rewrite(t, GROUPED, "");
        } while (t != prev);

        // 2) THE PERIOD CLOCK, but ONLY when a timezone marks it — before the decimal rule.
        t = Rewrite(t, PERIOD_CLOCK, "$1 ڪلاڪ $2 منٽ");

        // 3) DECIMAL POINT.
        t = Rewrite(t, DECIMAL, m =>
            $"{m.Groups[1].Value} پوائنٽ {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        // 4) CLOCK, COLON FORM.
        t = Rewrite(t, COLON_CLOCK, "$1 ڪلاڪ $2 منٽ");

        // 5) PERCENT — both placements.
        t = Rewrite(t, PERCENT_AFTER, "$1 سيڪڙو");
        t = Rewrite(t, PERCENT_BEFORE, "$1 سيڪڙو");

        // 6) DEGREES, BEFORE the unit rules.
        t = Rewrite(Rewrite(t, DEG_C_SIGN, "°C"), DEG_F_SIGN, "°F");
        t = Rewrite(t, DEG_C, "$1 ڊگري سينٽي گريڊ");
        t = Rewrite(t, DEG_F, "$1 ڊگري فارينهائيٽ");
        t = Rewrite(t, DEG, "$1 ڊگري");

        // 7) SQUARED then CUBED units, before the plain unit rule.
        t = Rewrite(t, KM2, "مربع ڪلوميٽر");
        t = Rewrite(t, M2, "مربع ميٽر");
        t = Rewrite(t, KM3, "ڪيوبڪ ڪلوميٽر");
        t = Rewrite(t, M3, "ڪيوبڪ ميٽر");

        // 8) RATES, then the plain LATIN UNIT ABBREVIATIONS after a number.
        t = Rewrite(t, KMH, "ڪلوميٽر في ڪلاڪ");
        t = Rewrite(t, MS, "ميٽر في سيڪنڊ");
        for (var i = 0; i < UNITS.Length; i++) t = Rewrite(t, UNIT_RES[i], $"$1 {UNITS[i].Word}");

        // 9) RANGES — the کان … تائين circumfix.
        t = Rewrite(t, RANGE, "$1 کان $2 تائين");

        // 10) CURRENCY, both placements.
        for (var i = 0; i < CURRENCY.Count; i++)
        {
            t = Rewrite(t, CURRENCY_BEFORE[i], $"$1 {CURRENCY[i].Value}");
            t = Rewrite(t, CURRENCY_AFTER[i], $"$1 {CURRENCY[i].Value}");
        }

        // 11) SIGNED NUMBERS — a sign PREFIXED to a number.
        t = Rewrite(t, SIGNED, m =>
            $" {(m.Groups[1].Value == "+" ? "جمع" : "منفي")} {m.Groups[2].Value}");

        // 12) ARITHMETIC AND RELATIONAL SIGNS.
        t = Rewrite(t, PLUS_MINUS, " جمع منفي ");
        t = Rewrite(t, PLUS, "$1 جمع $2");
        foreach (var (re, word) in RELATIONAL) t = Rewrite(t, re, word);

        // 13) AMPERSAND → ۽.
        t = Rewrite(t, AMPERSAND, " ۽ ");

        return Rewrite(t, SPACE_RUN, " ");
    }
}

/**
 * Sindhi (sd) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything the Sindhi g2p cannot
 * already read into Sindhi words the existing pipeline speaks. Pure text→text, no IPA. Runs inside
 * Sindhi.cs's `Text()`, before the tokenizer.
 * Ported from src/languages/sindhi/normalize.ts — see that file for the corpus evidence and the ordering
 * constraints between the rules.
 */
using Vernacula.Phonemizer.Core;

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

    /** ⚠ The composed unit regex takes "gu", NOT the `giu` of the UNITS entries' own literals — the `i` is
     *  dropped exactly as the TypeScript drops it. */
    private static readonly JsRe[] UNIT_RES =
        UNITS.Select(u => JsRegex.Compile($"(\\d)\\s*(?:{u.Source})(?!\\p{{L}})", "gu")).ToArray();

    private static readonly JsRe RANGE =
        JsRegex.Compile("(?<![-–—])(\\d+)\\s*[-–—]\\s*(\\d+)(?!\\d)(?!\\s*[-–—]\\s*\\d)", "gu");

    private static readonly JsRe ESCAPE = JsRegex.Compile("[.*+?^${}()|[\\]\\\\]", "gu");
    private static readonly JsRe[] CURRENCY_BEFORE =
        CURRENCY.Select(c => JsRegex.Compile($"{Esc(c.Key)}\\s*(\\d+)", "gu")).ToArray();
    private static readonly JsRe[] CURRENCY_AFTER =
        CURRENCY.Select(c => JsRegex.Compile($"(\\d+)\\s*{Esc(c.Key)}", "gu")).ToArray();

    private static string Esc(string sign) => ESCAPE.Replace(sign, "\\$&");

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
            t = GROUPED.Replace(t, "");
        } while (t != prev);

        // 2) THE PERIOD CLOCK, but ONLY when a timezone marks it — before the decimal rule.
        t = PERIOD_CLOCK.Replace(t, "$1 ڪلاڪ $2 منٽ");

        // 3) DECIMAL POINT.
        t = DECIMAL.Replace(t, m =>
            $"{m.Groups[1].Value} پوائنٽ {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        // 4) CLOCK, COLON FORM.
        t = COLON_CLOCK.Replace(t, "$1 ڪلاڪ $2 منٽ");

        // 5) PERCENT — both placements.
        t = PERCENT_AFTER.Replace(t, "$1 سيڪڙو");
        t = PERCENT_BEFORE.Replace(t, "$1 سيڪڙو");

        // 6) DEGREES, BEFORE the unit rules.
        t = DEG_F_SIGN.Replace(DEG_C_SIGN.Replace(t, "°C"), "°F");
        t = DEG_C.Replace(t, "$1 ڊگري سينٽي گريڊ");
        t = DEG_F.Replace(t, "$1 ڊگري فارينهائيٽ");
        t = DEG.Replace(t, "$1 ڊگري");

        // 7) SQUARED then CUBED units, before the plain unit rule.
        t = KM2.Replace(t, "مربع ڪلوميٽر");
        t = M2.Replace(t, "مربع ميٽر");
        t = KM3.Replace(t, "ڪيوبڪ ڪلوميٽر");
        t = M3.Replace(t, "ڪيوبڪ ميٽر");

        // 8) RATES, then the plain LATIN UNIT ABBREVIATIONS after a number.
        t = KMH.Replace(t, "ڪلوميٽر في ڪلاڪ");
        t = MS.Replace(t, "ميٽر في سيڪنڊ");
        for (var i = 0; i < UNITS.Length; i++) t = UNIT_RES[i].Replace(t, $"$1 {UNITS[i].Word}");

        // 9) RANGES — the کان … تائين circumfix.
        t = RANGE.Replace(t, "$1 کان $2 تائين");

        // 10) CURRENCY, both placements.
        for (var i = 0; i < CURRENCY.Count; i++)
        {
            t = CURRENCY_BEFORE[i].Replace(t, $"$1 {CURRENCY[i].Value}");
            t = CURRENCY_AFTER[i].Replace(t, $"$1 {CURRENCY[i].Value}");
        }

        // 11) SIGNED NUMBERS — a sign PREFIXED to a number.
        t = SIGNED.Replace(t, m =>
            $" {(m.Groups[1].Value == "+" ? "جمع" : "منفي")} {m.Groups[2].Value}");

        // 12) ARITHMETIC AND RELATIONAL SIGNS.
        t = PLUS_MINUS.Replace(t, " جمع منفي ");
        t = PLUS.Replace(t, "$1 جمع $2");
        foreach (var (re, word) in RELATIONAL) t = re.Replace(t, word);

        // 13) AMPERSAND → ۽.
        t = AMPERSAND.Replace(t, " ۽ ");

        return SPACE_RUN.Replace(t, " ");
    }
}

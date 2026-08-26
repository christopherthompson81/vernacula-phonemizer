/**
 * Sinhala (si) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/sinhala/normalize.ts — see that file for the corpus evidence behind every arm,
 * the joiner-strip that re-joins conjunct tokens, and the classes deliberately declined.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Sinhala;

public static class Normalize
{
    /** The shared symbol tier. Sinhala puts the measure word BEFORE the number, so all three prefix flags
     *  are set. `mg` is deliberately not declared — see the TS. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "සියයට" },
        PercentPrefix = true,
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["US$"] = new[] { "ඇමෙරිකානු ඩොලර්" }, ["$"] = new[] { "ඩොලර්" },
            ["€"] = new[] { "යූරෝ" }, ["£"] = new[] { "පවුම්" },
            ["Rs"] = new[] { "රුපියල්" }, ["₨"] = new[] { "රුපියල්" },
        },
        CurrencyPrefix = true,
        Magnitudes = new[] { "දහස", "ලක්ෂ", "කෝටි", "මිලියන", "බිලියන" },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "කිලෝමීටර්" }, ["m"] = new[] { "මීටර්" }, ["cm"] = new[] { "සෙන්ටිමීටර්" },
            ["mm"] = new[] { "මිලිමීටර්" },
            ["kg"] = new[] { "කිලෝග්‍රෑම්" }, ["ml"] = new[] { "මිලිලීටර්" }, ["ha"] = new[] { "හෙක්ටයාර්" },
        },
        UnitPrefix = true,
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "වර්ග" }, Cubed = new[] { "ඝන" }, Position = "before",
        },
        Ampersand = "සහ",
    });

    private static readonly JsRe NBSP = JsRegex.Compile("&nbsp;", "gu");
    private static readonly JsRe ZERO_WIDTH = JsRegex.Compile("[​-‍⁠﻿­]", "gu");

    /** Zero-width joiners and the HTML no-break space; run FIRST and again LAST. */
    private static string StripJoiners(string s) => ZERO_WIDTH.Replace(NBSP.Replace(s, " "), "");

    private const string B = "(?<![඀-෿])";
    private const string E = "(?![඀-෿])";

    private static (JsRe Re, string Word) Abbrev(string body, string word) =>
        (JsRegex.Compile(B + body + E, "gu"), word + " ");

    private static readonly IReadOnlyList<(JsRe Re, string Word)> DOTTED_ABBREV = new[]
    {
        Abbrev(@"ක්රි\.\s?පූ\.?", "ක්‍රිස්තු පූර්ව"),
        Abbrev(@"ක්රි\.\s?පු\.?", "ක්‍රිස්තු පූර්ව"),
        Abbrev(@"ක්රි\.\s?ව\.?", "ක්‍රිස්තු වර්ෂ"),
        Abbrev(@"ඇ\.\s?ඩො\.\s?මි\.?", "ඇමෙරිකානු ඩොලර් මිලියන"),
        Abbrev(@"ඇ\.\s?ඩො\.?", "ඇමෙරිකානු ඩොලර්"),
        Abbrev(@"කි\.\s?මී\.?", "කිලෝමීටර්"),
        Abbrev(@"සෙ\.\s?මී\.?", "සෙන්ටිමීටර්"),
        Abbrev(@"මි\.\s?මී\.?", "මිලිමීටර්"),
        (JsRegex.Compile(@"(?<![඀-෿])රු\.\s*(?=\p{Nd})", "gu"), "රුපියල් "),
    };

    private static readonly JsRe INITIALS = JsRegex.Compile(@"(?<![඀-෿.])(?:[඀-෿]{1,7}\.){2,}", "gu");
    private static readonly JsRe DOUBLE_SPACE = JsRegex.Compile("  +", "gu");
    private static readonly JsRe GROUPED = JsRegex.Compile(
        @"(?<![\p{Nd}.,])(\p{Nd}{1,3}(?:(?<!(?<!\p{Nd})0),\p{Nd}{3})+)(?![\p{Nd}])", "gu");
    private static readonly JsRe TRUNCATED_DECIMAL = JsRegex.Compile(@"(?<=[\s(\[])\.(?=\p{Nd})", "gu");

    private const string SIGN = "(\\u2212?)";
    private const string NUM = "(\\p{Nd}+(?:\\.\\p{Nd}+)?)";
    private const string DEG = "\\s*[°º\\u2070]\\s*";

    private static readonly JsRe CELSIUS = JsRegex.Compile(SIGN + NUM + DEG + "C(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe FAHRENHEIT = JsRegex.Compile(SIGN + NUM + DEG + "F(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe COMPASS_RE = JsRegex.Compile(NUM + DEG + "([NSEW])(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe BARE_DEGREE = JsRegex.Compile(SIGN + NUM + "\\s*[°º\\u2070]", "gu");
    private static readonly JsRe KELVIN = JsRegex.Compile(NUM + " K(?![\\p{L}\\p{M}.])", "gu");

    private static readonly IReadOnlyDictionary<string, string> COMPASS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["N"] = "උතුරු", ["S"] = "දකුණු", ["E"] = "නැගෙනහිර", ["W"] = "බටහිර",
    };

    private static string Neg(string sg) => sg.Length > 0 ? "ඍණ " : "";

    private static readonly JsRe ASCII_MINUS = JsRegex.Compile(@"(^|[(\[])[-–−](?=\p{Nd})", "gu");
    private static readonly JsRe UNICODE_MINUS = JsRegex.Compile(@"(?<=[\s(\[])−(?=\p{Nd})", "gu");

    private const string RATE_OPERAND =
        "(?:((?<![\\p{Nd}.,\\-–—])\\p{Nd}[\\p{Nd}.,]*(?:\\s?[-–—]\\s?\\p{Nd}[\\p{Nd}.,]*)?)\\s*)?";

    private static readonly IReadOnlyList<(JsRe Re, string Word)> RATES = new[]
    {
        (JsRegex.Compile($"{RATE_OPERAND}(?<![\\p{{L}}\\p{{M}}\\p{{Nd}}])km\\s?\\/\\s?h(?![\\p{{L}}\\p{{M}}])", "gu"), "පැයට කිලෝමීටර්"),
        (JsRegex.Compile($"{RATE_OPERAND}(?<![\\p{{L}}\\p{{M}}\\p{{Nd}}])m\\s?\\/\\s?s(?![\\p{{L}}\\p{{M}}])", "gu"), "තත්පරයට මීටර්"),
    };

    private static readonly JsRe CURRENCY_MILLION_SUFFIX =
        JsRegex.Compile(@"((?:US\$|[$€£₨])\s?\p{Nd}[\p{Nd}.,]*)m(?![\p{L}\p{M}])", "gu");
    private static readonly JsRe GLUED_METRES =
        JsRegex.Compile(@"(?<![\p{L}\p{Nd}.,])(\p{Nd}+\.\p{Nd}+)m(?![\p{L}\p{M}])", "gu");
    private static readonly JsRe DECIMAL_POINT =
        JsRegex.Compile(@"(?<![\p{Nd}.])(\p{Nd}+)\.(\p{Nd}+)(?![\p{Nd}.])", "gu");

    /** Port of `String.prototype.trimEnd()` — JS whitespace, not .NET's Unicode set. */
    private static string TrimEnd(string s)
    {
        var b = s.Length;
        while (b > 0 && Js.IsJsWhiteSpace(s[b - 1])) b--;
        return s[..b];
    }

    public static string NormalizeSinhala(string input)
    {
        var s = input;

        // 1) Joiners and entities — before everything; every literal below is written joiner-free.
        s = StripJoiners(s);

        // 2) Dotted abbreviations, closed list — era markers first.
        foreach (var (rx, word) in DOTTED_ABBREV) s = rx.Replace(s, word);

        // 3) Sinhala-letter initials: the dot becomes a SPACE, not nothing.
        s = INITIALS.Replace(s, m => TrimEnd(m.Value.Replace(".", " ", StringComparison.Ordinal)) + " ");
        s = DOUBLE_SPACE.Replace(s, " ");

        // 4) Thousands separator, then the truncated decimal (`.9%` → `0.9%`).
        s = GROUPED.Replace(s, m => m.Value.Replace(",", "", StringComparison.Ordinal));
        s = TRUNCATED_DECIMAL.Replace(s, "0.");

        // 5) Degrees — above the minus rule, which would otherwise attach the sign to the scale.
        s = CELSIUS.Replace(s, m => $"සෙල්සියස් අංශක {Neg(m.Groups[1].Value)}{m.Groups[2].Value}");
        s = FAHRENHEIT.Replace(s, m => $"ෆැරන්හයිට් අංශක {Neg(m.Groups[1].Value)}{m.Groups[2].Value}");
        s = COMPASS_RE.Replace(s, m => $"අංශක {m.Groups[1].Value} {COMPASS[m.Groups[2].Value]}");
        s = BARE_DEGREE.Replace(s, m => $"අංශක {Neg(m.Groups[1].Value)}{m.Groups[2].Value}");
        s = KELVIN.Replace(s, "කෙල්වින් $1");

        // 6) Negative numbers — only U+2212, plus a string/bracket-initial ASCII sign.
        s = ASCII_MINUS.Replace(s, "$1ඍණ ");
        s = UNICODE_MINUS.Replace(s, "ඍණ ");

        // 7) Rates — local, because the denominator takes a dative suffix and LEADS the phrase.
        foreach (var (rx, word) in RATES)
            s = rx.Replace(s, m => m.Groups[1].Success ? $"{word} {m.Groups[1].Value}" : word);

        // 8) The shared tier, with the two locally-spent `m` guards above it.
        s = CURRENCY_MILLION_SUFFIX.Replace(s, "$1 මිලියන");
        s = GLUED_METRES.Replace(s, "මීටර් $1");
        s = SYMBOLS(s);

        // 9) The decimal point; the fractional digits are emitted one at a time.
        s = DECIMAL_POINT.Replace(s, m =>
            $"{m.Groups[1].Value} දශම {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        // 12) Re-strip — the words emitted above carry their ordinary joiners.
        return StripJoiners(s);
    }
}

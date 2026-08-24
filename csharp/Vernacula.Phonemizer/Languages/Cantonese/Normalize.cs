/**
 * Cantonese / Yue (yue) text normalization — the pre-tokenizer pass that rewrites what is not yet a
 * pronounceable word into Han text the Han→Jyutping→IPA pipeline already speaks.
 * Ported from src/languages/cantonese/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Cantonese;

public static class Normalize
{
    /** 0–9 as Han numerals — RE-EXPORTED FROM `core/sinitic.ts`, not declared here. */
    public static IReadOnlyList<string> DIGITS => Sinitic.HAN_DIGITS;

    /** A digit string read one digit at a time — the reading Chinese gives a year (二零零九) and the fractional
     *  part of a decimal (點三四), as opposed to the cardinal a quantity gets. */
    private static string SpellDigits(string s) => Sinitic.SpellHanDigits(s);

    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Multiply = new MultiplyDef { Times = "乘" },
        Ampersand = "和",
        Percent = new[] { "百分之" },
        PercentPrefix = true,
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "公里" }, ["kg"] = new[] { "公斤" },
        },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "美元" }, ["€"] = new[] { "歐元" }, ["£"] = new[] { "英鎊" },
        },
        ExponentWords = new ExponentWordsDef { Squared = new[] { "平方" }, Position = ExponentPosition.Compound },
        UnspacedScript = true,
    });

    // The step patterns. The TS builds several of these inline; JsRegex.Compile caches, so hoisting them
    // here is a readability choice and not a behaviour one.
    private static readonly JsRe FULLWIDTH_PCT = JsRegex.Compile("％", "gu");
    private static readonly JsRe FULLWIDTH_SLASH = JsRegex.Compile("／", "gu");
    private static readonly JsRe PLUS = JsRegex.Compile("\\s*\\+\\s*(?=\\d)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s*=\\s*", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("\\s*<\\s*", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("\\s*>\\s*", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s*÷\\s*", "gu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d+)\\s*°", "gu");
    private static readonly JsRe YEAR_RANGE = JsRegex.Compile(
        "(?<![\\d.,])(\\d{4})\\s*([-–—])\\s*(\\d{4})(?![\\d]|[.,]\\d)|(?<![\\d.,])(\\d{4})\\s*([至到])\\s*(\\d{4})(?![\\d.,])(?=\\s*年)", "gu");
    private static readonly JsRe YEAR_BEFORE_NIAN = JsRegex.Compile("(?<![\\d.,:])(\\d{4})(?![\\d.,])(?=\\s*年)", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile(
        "(?<![\\d:])(\\d{1,2}):([0-5]\\d)(?![\\d:])(?:\\s*([ap])\\s*\\.?\\s*m\\s*\\.?(?![\\p{L}\\p{M}]))?", "giu");
    private static readonly JsRe DECIMAL_RE = JsRegex.Compile("(?<![\\d.])(\\d+)\\.(\\d+)(?![\\d.])", "gu");

    /** Normalize one Cantonese string. */
    public static string NormalizeCantonese(string input, string measureWords)
    {
        var s = input;

        s = JsRegex.Replace(s, FULLWIDTH_PCT, _ => "%");
        s = JsRegex.Replace(s, FULLWIDTH_SLASH, _ => "/");

        s = JsRegex.Replace(s, PLUS, _ => " 加 ");

        s = JsRegex.Replace(s, EQUALS, _ => " 等於 ");
        s = JsRegex.Replace(s, LESS_THAN, _ => " 小於 ");
        s = JsRegex.Replace(s, GREATER_THAN, _ => " 大於 ");
        s = JsRegex.Replace(s, DIVIDE, _ => " 除以 ");

        s = Sinitic.ReadDegrees(s, new DegreeData
        {
            Celsius = n => $"攝氏{n}度",
            Fahrenheit = n => $"華氏{n}度",
        });
        s = JsRegex.Replace(s, DEG_BARE, m => $"{m.Groups[1].Value}度");

        s = Sinitic.DegroupThousands(s);

        s = JsRegex.Replace(s, YEAR_RANGE, m =>
            m.Groups[1].Success
                ? $"{SpellDigits(m.Groups[1].Value)}至{SpellDigits(m.Groups[3].Value)}"
                : $"{SpellDigits(m.Groups[4].Value)}{m.Groups[5].Value}{SpellDigits(m.Groups[6].Value)}");

        s = JsRegex.Replace(s, YEAR_BEFORE_NIAN, m => SpellDigits(m.Groups[1].Value));

        s = JsRegex.Replace(s, CLOCK, m =>
        {
            var ap = m.Groups[3].Success ? m.Groups[3].Value : null;
            var pre = ap is null ? "" : ap.ToLowerInvariant() == "a" ? "上午" : "下午";
            var min = Js.Number(m.Groups[2].Value);
            var tail = min == 0 ? "" : min < 10 ? $"零{Js.NumberToString(min)}分" : $"{Js.NumberToString(min)}分";
            return $"{pre}{Js.NumberToString(Js.Number(m.Groups[1].Value))}點{tail}";
        });

        s = Sinitic.ReorderFraction(s, "分之");

        s = SYMBOLS(s);

        s = JsRegex.Replace(s, DECIMAL_RE, m => $"{m.Groups[1].Value}點{SpellDigits(m.Groups[2].Value)}");

        if (measureWords != "")
            s = JsRegex.Replace(s, JsRegex.Compile($"(?<![\\d.,])2(?=\\s*[{measureWords}])", "gu"), _ => "兩");

        return s;
    }
}

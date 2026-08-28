/**
 * Wu Chinese / Shanghainese (wuu) text normalization — the pre-tokenizer pass that rewrites what is not yet a
 * pronounceable word into Han text the Han→Wugniu→IPA pipeline already speaks. Pure text→text, no IPA.
 * Ported from src/languages/wu/normalize.ts — see that file for the corpus evidence and the step ordering.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Wu;

public static class Normalize
{
    /** 0–9 as Han numerals — RE-EXPORTED FROM `core/sinitic.ts`, not declared here. */
    public static IReadOnlyList<string> DIGITS => Sinitic.HAN_DIGITS;

    private static string SpellDigits(string s) => Sinitic.SpellHanDigits(s);

    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Ampersand = "搭",
        Percent = new[] { "百分之" },
        PercentPrefix = true,
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "公里" },
            ["kg"] = new[] { "公斤" },
        },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "美元" },
            ["£"] = new[] { "英镑" },
        },
        ExponentWords = new ExponentWordsDef { Squared = new[] { "平方" }, Position = ExponentPosition.Compound },
        UnspacedScript = true,
    });

    private const string MINUTE = "[′´ˊ’']";
    private const string SECOND = "[″〃”\"]";

    private static readonly JsRe COORD_DMS =
        JsRegex.Compile($"(\\d+)\\s*°\\s*(\\d+)\\s*{MINUTE}\\s*(\\d+)\\s*{SECOND}", "gu");
    private static readonly JsRe COORD_DM =
        JsRegex.Compile($"(\\d+)\\s*°\\s*(\\d+)\\s*{MINUTE}", "gu");
    private static readonly JsRe COORD_RANGE = JsRegex.Compile("([分秒])\\s*[-–—－~～〜]\\s*(?=\\d)", "gu");

    private const string NOT_QUANTITY = "(?!\\s*[万萬亿億元块塊人米吨噸])";
    private static readonly JsRe YEAR_RANGE_DASH = JsRegex.Compile(
        $"(?<![\\d.,])(\\d{{4}})\\s*[-–—－~～〜]\\s*(\\d{{4}})(?![\\d.,]){NOT_QUANTITY}", "gu");
    private static readonly JsRe YEAR_RANGE_WORD = JsRegex.Compile(
        "(?<![\\d.,])(\\d{4})\\s*([至到])\\s*(\\d{4})(?![\\d.,])(?=\\s*年)", "gu");
    private static readonly JsRe YEAR_RANGE_BOTH_NIAN = JsRegex.Compile(
        "(?<![\\d.,])(\\d{4})\\s*年\\s*[-–—－~～〜]\\s*(\\d{4})(?=\\s*年)", "gu");
    private static readonly JsRe YEAR_BEFORE_NIAN = JsRegex.Compile(
        "(?<![\\d.,:])(\\d{4})(?![\\d.,])(?=\\s*年)", "gu");

    private const string RANGE_UNIT =
        "(?:%|‰|°|摄氏度|度|月|日|号|號|年|岁|歲|世纪|世紀|公里|千米|米|毫米|公斤|吨|噸|万|萬|亿|億|元|人|个|個)";
    private static readonly JsRe QUANTITY_RANGE = JsRegex.Compile(
        $"(?<![\\d.,\\p{{sc=Latn}}])(\\d+(?:\\.\\d+)?)([%‰])?\\s*[-–—－~～〜]\\s*(\\d+(?:\\.\\d+)?)(?=\\s*{RANGE_UNIT})",
        "gu");

    private static readonly JsRe DENSITY = JsRegex.Compile(
        "(\\d+(?:\\.\\d+)?)\\s*(人?)\\s*\\/\\s*km\\s*(?:²|2)(?![\\p{sc=Latn}\\d])", "giu");
    private static readonly JsRe PERMILLE = JsRegex.Compile("(?<![\\d.,])(\\d+(?:\\.\\d+)?)\\s*‰", "gu");
    private static readonly JsRe DECIMAL_RE = JsRegex.Compile("(?<![\\d.:])(\\d+)\\.(\\d+)(?![\\d.])", "gu");
    private static readonly JsRe ITERATION = JsRegex.Compile("(\\p{Script=Han})々", "gu");
    private static readonly JsRe LETTER_SOLO = JsRegex.Compile(
        "(?<=\\p{Script=Han})([A-Z])(?![\\p{sc=Latn}\\d])|(?<![\\p{sc=Latn}\\d])([A-Z])(?=\\p{Script=Han})", "gu");
    private static readonly JsRe LETTER_RUN = JsRegex.Compile(
        "(?<![\\p{sc=Latn}\\d])[A-Z]{2,3}(?![\\p{sc=Latn}\\d])", "gu");
    private static readonly JsRe ROMAN_RUN = JsRegex.Compile("^[IVX]{2,3}$", "u");

    /** Normalize one Wu string. The steps are ORDER-DEPENDENT; the coupling is stated at each one in the TS. */
    public static string NormalizeWu(string input, string measureWords,
        IReadOnlyDictionary<string, string>? letterNames = null)
    {
        var s = input;

        s = Sinitic.DegroupThousands(s);

        s = Rewrite(s, COORD_DMS,
            m => $"{m.Groups[1].Value}度{m.Groups[2].Value}分{m.Groups[3].Value}秒");
        s = Rewrite(s, COORD_DM, m => $"{m.Groups[1].Value}度{m.Groups[2].Value}分");
        s = Rewrite(s, COORD_RANGE, m => $"{m.Groups[1].Value}到");

        s = Sinitic.ReadDegrees(s, new DegreeData
        {
            Celsius = n => $"{n}摄氏度",
            Fahrenheit = n => $"华氏{n}度",
            Bare = n => $"{n}度",
        });

        s = Rewrite(s, YEAR_RANGE_DASH,
            m => $"{SpellDigits(m.Groups[1].Value)}到{SpellDigits(m.Groups[2].Value)}");
        s = Rewrite(s, YEAR_RANGE_WORD,
            m => $"{SpellDigits(m.Groups[1].Value)}{m.Groups[2].Value}{SpellDigits(m.Groups[3].Value)}");
        s = Rewrite(s, YEAR_RANGE_BOTH_NIAN,
            m => $"{SpellDigits(m.Groups[1].Value)}年到{SpellDigits(m.Groups[2].Value)}");

        s = Rewrite(s, YEAR_BEFORE_NIAN, m => SpellDigits(m.Groups[1].Value));

        s = Rewrite(s, QUANTITY_RANGE,
            m => $"{m.Groups[1].Value}{(m.Groups[2].Success ? m.Groups[2].Value : "")}到{m.Groups[3].Value}");

        s = Sinitic.ReorderFraction(s, "分之");

        s = Rewrite(s, DENSITY, m => $"每平方公里{m.Groups[1].Value}{m.Groups[2].Value}");

        s = SYMBOLS(s);

        s = Rewrite(s, PERMILLE, m => $"千分之{m.Groups[1].Value}");

        s = Rewrite(s, DECIMAL_RE,
            m => $"{m.Groups[1].Value}点{SpellDigits(m.Groups[2].Value)}");

        if (measureWords != "")
            s = Rewrite(s, JsRegex.Compile($"(?<![\\d.,第])2(?=\\s*[{measureWords}])", "gu"), _ => "两");

        s = Rewrite(s, ITERATION, m => m.Groups[1].Value + m.Groups[1].Value);

        if (letterNames is not null)
        {
            s = Rewrite(s, LETTER_SOLO, m =>
            {
                var l = m.Groups[1].Success ? m.Groups[1].Value : m.Groups[2].Value;
                return letterNames.TryGetValue(l, out var han) ? $" {han} " : m.Value;
            });
            s = Rewrite(s, LETTER_RUN, m =>
                ROMAN_RUN.IsMatch(m.Value)
                    ? m.Value
                    : " " + string.Join(" ", Js.CodePoints(m.Value)
                        .Select(c => letterNames.TryGetValue(c, out var han) ? han : c)) + " ");
        }

        return s;
    }
}

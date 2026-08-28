/**
 * Hakka Chinese (hak, Meixian) text normalization — the pre-tokenizer pass rewriting what is not yet a
 * pronounceable word into Han the dict speaks. Pure text→text, and the steps are ORDER-DEPENDENT.
 * Ported from src/languages/hakka/normalize.ts — see that file for the corpus evidence and every refusal.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Hakka;

public static class Normalize
{
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Ampersand = "摎",
        Percent = new[] { "百分之" },
        PercentPrefix = true,
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "公里" }, ["kg"] = new[] { "公斤" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "平方" }, Position = ExponentPosition.Compound,
        },
        Currency = new Dictionary<string, IReadOnlyList<string>> { ["$"] = new[] { "美元" } },
        UnspacedScript = true,
    });

    /** The coordinate minute/second marks in every encoding the corpus writes. */
    private const string MINUTE = "[′´ˊ’']";
    private const string SECOND = "[″〃”\"]";

    /** The right-hand context that licenses a numeric range — ⚠ the guard is the whole rule, and it is the
     *  one place this file must read PFS rather than only Han. */
    private const string RANGE_UNIT =
        "(?:%|‰|度|天|月|日|年|人|元|米|屆|亿|億|万|萬|公里|毫米|" +
        "k[ûu]ng-l[îi]|k[ûu]ng-chhak|k[ûu]ng-k[îi]n|m[íi]|ml|f[ûu]n-ch[ûu]ng|ng[ìi]n|[Cc]h[ôo]ng|ts[ôo]ng|chiet|tsiet)";

    private static readonly JsRe YEAR_MORPHEME =
        JsRegex.Compile("(?<![\\p{L}\\d])(\\d{1,4})[-\\s]ngi[eè]n(?=[^\\p{L}]|$)", "gu");
    private static readonly JsRe COORD_DMS =
        JsRegex.Compile($"(\\d+)\\s*°\\s*(\\d+)\\s*{MINUTE}\\s*(\\d+)\\s*{SECOND}", "gu");
    private static readonly JsRe COORD_DM = JsRegex.Compile($"(\\d+)\\s*°\\s*(\\d+)\\s*{MINUTE}", "gu");
    private static readonly JsRe COORD_RANGE = JsRegex.Compile("([分秒])\\s*[-–—－~～〜]\\s*(?=\\d)", "gu");
    private static readonly JsRe NEGATIVE_TEMP = JsRegex.Compile("(?<![\\d\\p{L}])[-−](攝氏|華氏)", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile(
        $"(?<![\\d.,:\\p{{sc=Latn}}])(\\d+(?:\\.\\d+)?)([%‰])?\\s*[-–—－~～〜]\\s*(\\d+(?:\\.\\d+)?)(?=\\s*{RANGE_UNIT})",
        "gu");
    private static readonly JsRe PERMILLE =
        JsRegex.Compile("(?<![\\d.,])(\\d+(?:\\.\\d+)?(?:至\\d+(?:\\.\\d+)?)?)\\s*‰", "gu");

    private static readonly DegreeData DEGREES = new()
    {
        Celsius = n => $"攝氏{n}度",
        Fahrenheit = n => $"華氏{n}度",
        Bare = n => $"{n}度",
    };

    /** Normalize one Hakka string. */
    public static string NormalizeHakka(string input)
    {
        var s = input;
        s = Sinitic.DegroupThousands(s);
        s = Rewrite(s, YEAR_MORPHEME, "$1年");
        s = Rewrite(s, COORD_DMS, "$1度$2分$3秒");
        s = Rewrite(s, COORD_DM, "$1度$2分");
        s = Rewrite(s, COORD_RANGE, "$1至");
        s = Sinitic.ReadDegrees(s, DEGREES);
        s = Rewrite(s, NEGATIVE_TEMP, "$1零下");
        s = Sinitic.SpellYears(s, new YearRuleData { RangeWord = "至" });
        s = Rewrite(s, RANGE, m => $"{m.Groups[1].Value}{(m.Groups[2].Success ? m.Groups[2].Value : "")}至{m.Groups[3].Value}");
        s = Sinitic.ReorderFraction(s, "分之");
        s = SYMBOLS(s);
        s = Rewrite(s, PERMILLE, "千分之$1");
        s = Sinitic.ReadDecimals(s, "點");
        return s;
    }
}

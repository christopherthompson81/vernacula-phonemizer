/**
 * Min Nan / Taiwanese Hokkien (nan) text normalization — the pre-tokenizer pass that rewrites what is not
 * yet a pronounceable word into words the POJ/Han → IPA pipeline already speaks. Pure text→text, no IPA.
 * Ported from src/languages/minnan/normalize.ts — see that file for the corpus evidence, the sourcing of
 * every word, the refusals (the ASCII hyphen above all) and the step ordering.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.MinNan;

public static class Normalize
{
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Ampersand = "佮",
        Percent = new[] { "百分之" },
        PercentPrefix = true,
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "公里" },
            ["m"] = new[] { "公尺" },
            ["kg"] = new[] { "公斤" },
            ["cm"] = new[] { "公分" },
            ["mg"] = new[] { "毫克" },
            ["ml"] = new[] { "毫升" },
        },
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["biáu"] = "秒", ["s"] = "秒", ["kg"] = "公斤", ["ml"] = "毫升",
        },
        UnitPer = "每",
        ExponentWords = new ExponentWordsDef { Squared = new[] { "平方" }, Position = ExponentPosition.Compound },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["US$"] = new[] { "美金" },
            ["$"] = new[] { "箍" },
        },
        Magnitudes = new[] { "ek", "bān", "ban", "chheng", "pah", "億", "萬", "千", "百" },
    });

    private static readonly JsRe OO_MIDDLE_DOT = JsRegex.Compile("([oOòóôōǒÒÓÔŌǑ]\\p{M}*)[·‧]", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile("(\\d)((?:\\s*°\\s*C|℃|\\s*°|%)?)\\s*[–~〜]\\s*(?=\\d)", "gui");

    private const string NAN_UNIT_AHEAD = "(?=\\p{Nd}[\\d.,]*\\s*(?:°|%|\\p{sc=Latn}))";
    private static readonly JsRe MINUS_UNIT =
        JsRegex.Compile("(?<![\\p{L}\\p{M}\\p{Nd}])(?<!\\p{Nd}\\s)−" + NAN_UNIT_AHEAD, "gu");
    private static readonly JsRe MINUS_LEAD = JsRegex.Compile("(^|[(（,，])\\s?−(?=\\p{Nd})", "gmu");

    private static readonly JsRe COORD_DMS = JsRegex.Compile("(\\d+)\\s*°\\s*(\\d+)\\s*[′']\\s*(\\d+)\\s*[″\"]", "gu");
    private static readonly JsRe COORD_DM = JsRegex.Compile("(\\d+)\\s*°\\s*(\\d+)\\s*[′']", "gu");

    /** Normalize one Min Nan string. The steps are ORDER-DEPENDENT; each states what breaks if it moves
     *  in the TS. */
    public static string NormalizeMinNan(string input)
    {
        var s = input;

        s = Rewrite(s, OO_MIDDLE_DOT, "$1͘");

        s = Sinitic.DegroupThousands(s);

        s = Rewrite(s, RANGE, "$1$2 到 ");

        s = Rewrite(s, MINUS_UNIT, "負");
        s = Rewrite(s, MINUS_LEAD, "$1負");

        s = Rewrite(s, COORD_DMS, "$1度 $2 $3");
        s = Rewrite(s, COORD_DM, "$1度 $2");

        s = Sinitic.ReadDegrees(s, new DegreeData
        {
            Celsius = n => $"攝氏{n}度",
            Bare = n => $"{n}度 ",
        });

        s = SYMBOLS(s);

        s = Sinitic.ReadDecimals(s, "點");

        return s;
    }
}

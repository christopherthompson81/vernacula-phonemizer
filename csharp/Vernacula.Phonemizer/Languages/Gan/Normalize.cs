/**
 * Gan Chinese (gan, Nanchang) text normalization — the pre-tokenizer pass that rewrites what is not yet a
 * pronounceable word into Han the dict already speaks. Pure text→text, no IPA.
 * Ported from src/languages/gan/normalize.ts — see that file for the corpus evidence and every refusal.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Gan;

public static class Normalize
{
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Ampersand = "同到",
        Percent = new[] { "百分之" },
        PercentPrefix = true,
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "公里" },
            ["kg"] = new[] { "公斤" },
        },
        Magnitudes = new[] { "萬", "億", "万", "亿" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "美元" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "平方" },
            Cubed = new[] { "立方" },
            Position = ExponentPosition.Compound,
        },
        UnspacedScript = true,
    });

    private static readonly JsRe ORD_A = JsRegex.Compile("ª", "gu");
    private static readonly JsRe ORD_O = JsRegex.Compile("º", "gu");
    private static readonly JsRe PER_MILLE = JsRegex.Compile("(?<![\\d.,])(\\d+(?:\\.\\d+)?)\\s*‰", "gu");
    private static readonly JsRe NEGATIVE = JsRegex.Compile("(^|[\\s(（、,，])[-−](\\d)", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile(
        "(?<![\\d.,/\\-\\p{sc=Latn}])(\\d+)\\s*[-–~〜－]\\s*(\\d+)(?![\\d.,/\\-\\p{sc=Latn}])", "gu");
    /** ⚠ A one-character lookbehind cannot express "not after a Latin RUN": `ISO 8859-1` puts a SPACE between
     *  the identifier and the digits, so the guard would read the designation as "8859 到 1". */
    private static readonly JsRe LATIN_BEFORE = JsRegex.Compile("\\p{sc=Latn}[\\s\\p{sc=Latn}]*$", "u");

    /** Normalize one Gan string. The steps are ORDER-DEPENDENT — see the TS for what breaks if one moves. */
    public static string NormalizeGan(string input)
    {
        var s = input;
        s = ORD_O.Replace(ORD_A.Replace(s, _ => "a"), _ => "o");
        s = Sinitic.DegroupThousands(s);
        s = ProtectDurations(s);
        s = Sinitic.SpellYears(s, new YearRuleData { RangeWord = "到" });
        s = s.Replace(AGO, "年");
        s = Sinitic.ReorderFraction(s, "分之");
        s = SYMBOLS(s);
        s = PER_MILLE.Replace(s, m => $"千分之{m.Groups[1].Value}");
        s = Sinitic.ReadDecimals(s, "點");
        s = NEGATIVE.Replace(s, m => $"{m.Groups[1].Value}負{m.Groups[2].Value}");
        s = RANGE.Replace(s, m =>
        {
            var before = s[Math.Max(0, m.Index - 12)..m.Index];
            return LATIN_BEFORE.IsMatch(before) ? m.Value : $"{m.Groups[1].Value}到{m.Groups[2].Value}";
        });
        return s;
    }

    /** ⚠ A PUA sentinel (U+E000), which cannot occur in the text; swapped back immediately after SpellYears. */
    private const string AGO = "";

    private static readonly JsRe DURATION = JsRegex.Compile(
        "(\\d{4})年(\\s*(?:到|至|[-–~〜－])\\s*)(\\d{4})年(?=前)", "gu");

    private static string ProtectDurations(string s) =>
        DURATION.Replace(s, m => $"{m.Groups[1].Value}{AGO}{m.Groups[2].Value}{m.Groups[3].Value}{AGO}");
}

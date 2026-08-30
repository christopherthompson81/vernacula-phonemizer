/**
 * Xiang Chinese (hsn, Changsha) text normalization — the pre-tokenizer pass rewriting what is not yet a
 * pronounceable word into Han the dict speaks. Pure text→text.
 * Ported from src/languages/xiang/normalize.ts — see that file for the corpus evidence and every refusal
 * (no bareExponent: 23 of 24 superscript runs here are romanization TONE NUMBERS; no degree, ×, =, currency).
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Xiang;

public static class Normalize
{
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Ampersand = "跟",
        Percent = new[] { "百分之" },
        PercentPrefix = true,
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "公里" }, ["kg"] = new[] { "公斤" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "平方" }, Cubed = new[] { "立方" }, Position = ExponentPosition.Compound,
        },
        UnspacedScript = true,
    });

    /** `N年前` is "N years AGO", a quantity — the sentinel hides the year from spellYears and is a PUA code
     *  point, which cannot occur in the text. */
    private const string AGO = Markers.PUA_SENTINEL;
    private static readonly JsRe AGO_MARK = JsRegex.Compile("(\\d{4})年(?=前)", "gu");
    private static readonly JsRe JS_META = JsRegex.Compile("[.*+?^${}()|[\\]\\\\]", "gu");
    private static readonly JsRe AGO_RE = JsRegex.Compile(JS_META.Replace(AGO, "\\$&"), "gu"); // escaped — see Gan

    private static readonly JsRe RANGE = JsRegex.Compile(
        "(?<![\\d.,/\\-\\p{sc=Latn}])(\\d+)\\s*[-–~〜－]\\s*(\\d+)(?![\\d.,/\\-\\p{sc=Latn}])", "gu");
    /** ⚠ A one-character lookbehind cannot express "not after a Latin RUN": `ISO 8859-1` puts a SPACE between
     *  the identifier and the digits, so the guard saw the space and read the designation as "8859 到 1". */
    private static readonly JsRe LATIN_BEFORE = JsRegex.Compile("\\p{sc=Latn}[\\s\\p{sc=Latn}]*$", "u");

    public static string NormalizeXiang(string input)
    {
        var s = input;
        s = Sinitic.DegroupThousands(s);
        s = Rewrite(s, AGO_MARK, m => $"{m.Groups[1].Value}{AGO}");
        s = Sinitic.SpellYears(s, new YearRuleData { RangeWord = "到" });
        s = Rewrite(s, AGO_RE, "年"); // see Gan for why a literal all-replace becomes a global regex here
        s = Sinitic.ReorderFraction(s, "分之");
        s = SYMBOLS(s);
        s = Sinitic.ReadDecimals(s, "點");
        // ⚠ `full` is the pre-replace string, matching the TS callback's 4th argument.
        var full = s;
        s = Rewrite(s, RANGE, m =>
        {
            var before = full[Math.Max(0, m.Index - 12)..m.Index];
            return LATIN_BEFORE.IsMatch(before) ? m.Value : $"{m.Groups[1].Value}到{m.Groups[2].Value}";
        });
        return s;
    }
}

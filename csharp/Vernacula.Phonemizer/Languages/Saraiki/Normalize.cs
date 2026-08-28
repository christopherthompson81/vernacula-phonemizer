/**
 * Saraiki (skr) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/saraiki/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Saraiki;

public static class Normalize
{
    /** The shared SYMBOL tier. ⚠ NO `Units` KEY — see the TS header: this language spells its measures out
     *  and the corpus-wide count is four. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "فیصد" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            // ⚠ `US$` DECLARED AHEAD OF `$` — the keys match longest-first, but the order is kept as the TS
            // writes it so the two files diff mechanically.
            ["US$"] = new[] { "ڈالر" }, ["$"] = new[] { "ڈالر" }, ["€"] = new[] { "یورو" },
            ["£"] = new[] { "پاؤنڈ" }, ["₨"] = new[] { "روپے" },
        },
        Ampersand = "تے",
        Magnitudes = new[] { "ملین", "بلین" },
    });

    private static readonly JsRe ZW_BEFORE_SIGN = JsRegex.Compile("(?<=\\d)[\\u200c\\u200d]+(?=[%\\u066a\\u00b0\\u066b])", "gu");
    private static readonly JsRe GROUPED = JsRegex.Compile("(?<!\\d)(?<![\\d][.,،])([1-9]\\d{0,2})((?:[,،]\\s?\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe GROUP_MARK = JsRegex.Compile("[,،\\s]", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?°\\s?F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d)\\s?°", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|(?<!\\d)[\\s(])[-−–]\\s?(\\d)", "gu");
    private static readonly JsRe RANGE_DASH = JsRegex.Compile("([\\dء])\\s?[–—]\\s?(?=\\d)", "gu");
    private static readonly JsRe RANGE_HYPHEN = JsRegex.Compile("(?<![\\d.,\\-\\/])(\\d+)\\s?-\\s?(\\d+)(?![\\d\\/])(?!\\s?-\\s?\\d)", "gu");
    private static readonly JsRe DECIMAL = JsRegex.Compile("(\\d)\\.(\\d+)(?!\\d)", "gu");
    private static readonly JsRe SPACE_RUN = JsRegex.Compile("[^\\S\\n]{2,}", "gu");

    /** Normalize one Saraiki input string. Pure text→text. Steps are ORDER-DEPENDENT; the input has already
     *  been through `FoldNativeDigits`, so every pattern is written against ASCII digits. */
    public static string NormalizeSaraiki(string input)
    {
        var s = input;

        // 0) Zero-width joiners between a figure and its sign — narrow on purpose (ZWNJ is meaningful
        //    orthography inside a word).
        s = Rewrite(s, ZW_BEFORE_SIGN, "");

        // 1) THE SHARED SYMBOL TIER FIRST: its numeral pattern reads `2,500`/`2.3` as ONE token, and steps 2
        //    and 5 split precisely those.
        s = SYMBOLS(s);

        // 2) DE-GROUPING, on BOTH commas, by the three-digit test.
        s = Rewrite(s, GROUPED, m => m.Groups[1].Value + GROUP_MARK.Replace(m.Groups[2].Value, ""));

        // 3) DEGREES.
        s = Rewrite(s, DEG_C, "$1 ڈگری سینٹی گریڈ");
        s = Rewrite(s, DEG_F, "$1 ڈگری فارن ہائیٹ");
        s = Rewrite(s, DEG, "$1 ڈگری ");

        // 4) THE MINUS SIGN, before the range rule spends the hyphen.
        s = Rewrite(s, MINUS, "$1منفی $2");

        // 5) RANGES — the ء year marker may sit between the figure and the dash.
        s = Rewrite(s, RANGE_DASH, "$1, ");
        s = Rewrite(s, RANGE_HYPHEN, "$1, $2");

        // 6) DECIMALS, LAST — this step SPLITS the numeral and every rule above wants it whole.
        s = Rewrite(s, DECIMAL, m =>
            $"{m.Groups[1].Value} اعشاریہ {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        return Rewrite(s, SPACE_RUN, " ");
    }
}

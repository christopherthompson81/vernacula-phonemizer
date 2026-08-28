/**
 * Umbundu (umb) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks.
 * Ported from src/languages/umbundu/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Umbundu;

public static class Normalize
{
    /** The shared SYMBOL tier. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Ampersand = "kwenda",
        Percent = Manifest.MANIFEST.SymbolTier.Percent,
        Units = Manifest.MANIFEST.SymbolTier.Units,
    });

    private static readonly JsRe IOTA_LOWER = JsRegex.Compile("ῖ", "gu");
    private static readonly JsRe IOTA_UPPER = JsRegex.Compile("Ῑ", "gu");
    private static readonly JsRe DOT_GROUP = JsRegex.Compile("(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:\\.\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(\\d),(?=\\d)", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(?<![\\d:.,])([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:])(?!\\.\\d)", "gu");
    private static readonly JsRe HOUR_H = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d])([01]?\\d|2[0-3])h([0-5]\\d)(?![\\p{L}\\p{M}\\d])", "gu");
    private static readonly JsRe SPACED_DASH = JsRegex.Compile(" [-–] (?=\\S)", "gu");
    private static readonly JsRe TIGHT_RANGE = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d.,\\-\\/])(\\d+)-(\\d+)(?![\\d\\/])", "gu");
    private static readonly JsRe MULTI_SPACE = JsRegex.Compile("[^\\S\\n]{2,}", "gu");

    /** Normalize one Umbundu input string. Pure text→text. Steps are ORDER-DEPENDENT. */
    public static string NormalizeUmbundu(string input)
    {
        var s = input;

        s = Rewrite(Rewrite(s, IOTA_LOWER, "ĩ"), IOTA_UPPER, "Ĩ");

        s = SYMBOLS(s);

        s = Rewrite(s, DOT_GROUP, m => m.Groups[1].Value + DOTS.Replace(m.Groups[2].Value, ""));

        s = Rewrite(s, DECIMAL_COMMA, "$1 ");

        s = Rewrite(s, CLOCK, "$1 $2");

        s = Rewrite(s, HOUR_H, "$1 $2");

        s = Rewrite(s, SPACED_DASH, ", ");

        s = Rewrite(s, TIGHT_RANGE, "$1, $2");

        return Rewrite(s, MULTI_SPACE, " ");
    }
}

/**
 * Umbundu (umb) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks.
 * Ported from src/languages/umbundu/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Umbundu;

public static class Normalize
{
    /** The shared SYMBOL tier. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "porcento" },
        Units = new Dictionary<string, IReadOnlyList<string>> { ["m"] = new[] { "metelo" } },
        Ampersand = "kwenda",
    });

    private static readonly JsRe IOTA_LOWER = JsRegex.Compile("ῖ", "gu");
    private static readonly JsRe IOTA_UPPER = JsRegex.Compile("Ῑ", "gu");
    private static readonly JsRe DOT_GROUP = JsRegex.Compile("(?<!\\d)(?<![\\d][.,])(\\d{1,3})((?:\\.\\d{3})+)(?!\\d)", "gu");
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

        s = IOTA_UPPER.Replace(IOTA_LOWER.Replace(s, "ĩ"), "Ĩ");

        s = SYMBOLS(s);

        s = DOT_GROUP.Replace(s, m => m.Groups[1].Value + DOTS.Replace(m.Groups[2].Value, ""));

        s = DECIMAL_COMMA.Replace(s, "$1 ");

        s = CLOCK.Replace(s, "$1 $2");

        s = HOUR_H.Replace(s, "$1 $2");

        s = SPACED_DASH.Replace(s, ", ");

        s = TIGHT_RANGE.Replace(s, "$1, $2");

        return MULTI_SPACE.Replace(s, " ");
    }
}

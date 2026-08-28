/**
 * Quechua / Runasimi (qu) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks.
 * Ported from src/languages/quechua/normalize.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Quechua;

public static class Normalize
{
    /** The shared symbol tier. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        CountForm = _ => 0,
        Currency = Manifest.MANIFEST.SymbolTier.Currency,
        Units = Manifest.MANIFEST.SymbolTier.Units,
        ExponentWords = Manifest.MANIFEST.SymbolTier.ExponentWords,
        Magnitudes = Manifest.MANIFEST.SymbolTier.Magnitudes,
        Ampersand = Manifest.MANIFEST.SymbolTier.Ampersand,
    });

    private static readonly IReadOnlyDictionary<string, string> ENTITY = new Dictionary<string, string>
    {
        ["&nbsp;"] = " ", ["&bull;"] = " ", ["&sup2;"] = "²", ["&sup3;"] = "³",
    };

    private static readonly JsRe AMP = JsRegex.Compile("&amp;", "giu");
    private static readonly JsRe ENTITIES = JsRegex.Compile("&(?:nbsp|bull|sup2|sup3);", "giu");
    private static readonly JsRe FORMAT_CHAR = JsRegex.Compile("\\p{Cf}", "gu");
    private static readonly JsRe GROUP_DOT = JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})(?:\\.\\d{3})+(?!\\d)", "gu");
    private static readonly JsRe GROUP_COMMA = JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})(?:,\\d{3})+(?!\\d)", "gu");
    private static readonly JsRe GROUP_SPACE = JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2})(?:[ \u00a0\u202f\u2009]\\d{3})+(?!\\d)", "gu");
    private static readonly JsRe DOT = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe COMMA = JsRegex.Compile(",", "gu");
    private static readonly JsRe SPACE_SEP = JsRegex.Compile("[ \u00a0\u202f\u2009]", "gu");
    private static readonly JsRe DEGREE = JsRegex.Compile("(?<![\\p{L}\\p{M}])(\\d+)\\s?°(?![CF])", "gui");
    private static readonly JsRe DECIMAL_SEP = JsRegex.Compile("(\\d)[.,](\\d)", "gu");

    /** Quechua text normalization. */
    public static string NormalizeQuechua(string input)
    {
        var s = input;

        s = AMP.Replace(s.Normalize(NormalizationForm.FormC), "&");
        // ⚠ THE MISS BRANCH IS REACHABLE AND FALLS BACK TO THE MATCH (#1122): the pattern's `iu` flags fold
        // U+017F LONG S onto `s`, so `&ſup2;` matches while its key does not exist. The TS asserted non-null
        // and spoke the word "undefined"; this indexer THREW `KeyNotFoundException` for the whole caller.
        s = Rewrite(s, ENTITIES, m => ENTITY.TryGetValue(m.Value.ToLowerInvariant(), out var v) ? v : m.Value);
        s = Rewrite(s, FORMAT_CHAR, "");

        s = Rewrite(s, GROUP_DOT, m => DOT.Replace(m.Value, ""));
        s = Rewrite(s, GROUP_COMMA, m => COMMA.Replace(m.Value, ""));
        s = Rewrite(s, GROUP_SPACE, m => SPACE_SEP.Replace(m.Value, ""));

        // ⚠ ORDER: the tier runs AFTER de-grouping and BEFORE the decimal step — its version guard works by
        // seeing the dot that the decimal step below spends.
        s = SYMBOLS(s);

        // ⚠ THE NEIGHBOURHOOD IS READ OFF THE PRE-REPLACEMENT STRING, as in the TS: the JS replacer closes
        // over `s` before the assignment lands, so every window is cut from the same text.
        var before = s;
        s = Rewrite(s, DEGREE, m =>
        {
            var n = m.Groups[1].Value;
            var at = m.Index;
            var near = before[Math.Max(0, at - 40)..Math.Min(before.Length, at + m.Value.Length + 40)];
            return near.Contains("k'atma", StringComparison.Ordinal) ? n : $"{n} k'atma";
        });

        s = Rewrite(s, DECIMAL_SEP, "$1 $2");

        return s;
    }
}

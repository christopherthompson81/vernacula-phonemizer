/**
 * Quechua / Runasimi (qu) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks.
 * Ported from src/languages/quechua/normalize.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Quechua;

public static class Normalize
{
    /** The shared symbol tier. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["US$"] = new[] { "thular", "dular" },
            ["$"] = new[] { "thular", "dular" },
        },
        CountForm = _ => 0,
        Magnitudes = new[] { "waranqa hunu", "hunu", "waranqa", "lluna" },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "kilumitru" },
            ["m"] = new[] { "mitru" },
            ["cm"] = new[] { "sintimitru" },
            ["mm"] = new[] { "milimitru" },
            ["nm"] = new[] { "nanumitru" },
            ["kg"] = new[] { "kilugramu" },
            ["Å"] = new[] { "angstrom" },
            ["m/s"] = new[] { "mitru sikunduman" },
            ["km/s"] = new[] { "kilumitru sikunduman" },
            ["m³/s"] = new[] { "machina mitru sikunduman" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "t'asra" },
            Cubed = new[] { "machina" },
            Position = ExponentPosition.Before,
        },
        Ampersand = "wan",
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
        s = ENTITIES.Replace(s, m => ENTITY[m.Value.ToLowerInvariant()]);
        s = FORMAT_CHAR.Replace(s, "");

        s = GROUP_DOT.Replace(s, m => DOT.Replace(m.Value, ""));
        s = GROUP_COMMA.Replace(s, m => COMMA.Replace(m.Value, ""));
        s = GROUP_SPACE.Replace(s, m => SPACE_SEP.Replace(m.Value, ""));

        // ⚠ ORDER: the tier runs AFTER de-grouping and BEFORE the decimal step — its version guard works by
        // seeing the dot that the decimal step below spends.
        s = SYMBOLS(s);

        // ⚠ THE NEIGHBOURHOOD IS READ OFF THE PRE-REPLACEMENT STRING, as in the TS: the JS replacer closes
        // over `s` before the assignment lands, so every window is cut from the same text.
        var before = s;
        s = DEGREE.Replace(s, m =>
        {
            var n = m.Groups[1].Value;
            var at = m.Index;
            var near = before[Math.Max(0, at - 40)..Math.Min(before.Length, at + m.Value.Length + 40)];
            return near.Contains("k'atma", StringComparison.Ordinal) ? n : $"{n} k'atma";
        });

        s = DECIMAL_SEP.Replace(s, "$1 $2");

        return s;
    }
}

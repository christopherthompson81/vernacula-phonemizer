/**
 * Min Dong / Eastern Min (cdo, Fuzhou) text normalization — the pre-tokenizer pass that rewrites what is
 * not yet a pronounceable word into Bàng-uâ-cê the converter already speaks. Pure text→text, no IPA.
 * Ported from src/languages/mindong/normalize.ts — see that file for the corpus evidence, the sourcing of
 * every word and the refusals.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.MinDong;

public static class Normalize
{
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "báh-hŭng-cĭ" },
        PercentPrefix = true,
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "gŭng-lī" },
            ["cm"] = new[] { "lī-mī" },
            ["mm"] = new[] { "hò̤-mī" },
            ["kg"] = new[] { "gŭng-gĭng" },
            ["m"] = new[] { "mī" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "bìng-huŏng" },
            Cubed = new[] { "lĭk-huŏng" },
            Position = ExponentPosition.Before,
        },
    });

    private static readonly JsRe COORD = JsRegex.Compile(@"(\d+)\s*°\s*(\d+)\s*['′](?:\s*(\d+(?:\.\d+)?)\s*[""″])?", "gu");
    private static readonly JsRe PERCENT_RANGE = JsRegex.Compile(@"(?<![\d.,:/-])(\d+(?:\.\d+)?)\s*%?\s*[-–—~～〜]\s*(\d+(?:\.\d+)?)\s*%", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile(@"(?<![\d.,:/\-–—])(\d+)\s*[-–—~～〜]\s*(\d+)(?![\d:/\-–—])", "gu");
    // The one extra range guard: an ALL-CAPS acronym (≥2 letters) immediately before the left endpoint is
    // a designation (`ISO 639-3`), and nothing in BUC ends in a capital.
    private static readonly JsRe ALLCAPS_BEFORE = JsRegex.Compile(@"(?:^|[^\p{L}\p{M}])[A-Z]{2,}[\s.]*$", "u");

    // The digit table for ReadDecimals — a SPACE plus the ASCII digit, so the fractional part comes out as
    // separate tokens the engine's own number path reads one at a time (the shared Han table joins with
    // nothing, which is one fused syllable in a space-separated orthography).
    private static readonly IReadOnlyList<string> SPACED_DIGITS =
        new[] { " 0", " 1", " 2", " 3", " 4", " 5", " 6", " 7", " 8", " 9" };

    /** Normalize one Min Dong (Bàng-uâ-cê) string. The steps are ORDER-DEPENDENT; the TS states what breaks
     *  if any of them moves. */
    public static string NormalizeMinDong(string input)
    {
        var s = input;

        s = Sinitic.DegroupThousands(s);

        // BEFORE the degree rules: the whole DMS shape is claimed at once, keyed on the °.
        s = Rewrite(s, COORD, m =>
        {
            var d = m.Groups[1].Value;
            var min = m.Groups[2].Value;
            return m.Groups[3].Success ? $"{d} dô {min} hŭng {m.Groups[3].Value} miēu" : $"{d} dô {min} hŭng";
        });

        s = Sinitic.ReadDegrees(s, new DegreeData
        {
            Celsius = n => $"{n} dô",
            Fahrenheit = n => $"{n} dô",
            Bare = n => $"{n} dô",
        });

        // BEFORE the tier: after it each % is claimed and a word sits between the digits and the dash.
        s = Rewrite(s, PERCENT_RANGE, m => $"báh-hŭng-cĭ {m.Groups[1].Value} gáu {m.Groups[2].Value}");

        s = SYMBOLS(s);

        s = Sinitic.ReorderFraction(s, " hŭng-cĭ ");

        s = Sinitic.ReadDecimals(s, " diēng", SPACED_DIGITS);

        // LAST, so every rule that owns a dash has already consumed it.
        var str = s;
        s = Rewrite(str, RANGE, m =>
        {
            var off = m.Index;
            var before = str[Math.Max(0, off - 12)..off];
            return ALLCAPS_BEFORE.IsMatch(before) ? m.Value : $"{m.Groups[1].Value} gáu {m.Groups[2].Value}";
        });

        return s;
    }
}

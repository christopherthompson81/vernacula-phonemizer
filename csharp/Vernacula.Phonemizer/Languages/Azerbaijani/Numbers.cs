/**
 * Azerbaijani cardinal number → words (space-separated); thousands scale, "bir" dropped before yüz/min.
 * Ported from src/languages/azerbaijani/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Azerbaijani;

public static class AzerbaijaniNumbers
{
    private static AzerbaijaniNumbersDef N => Manifest.MANIFEST.Numbers;
    private static string[] ONES => N.Ones;
    private static string[] TENS => N.Tens;
    private static string[] SCALES => N.Scales;

    /** 1 ≤ n < 1000 → words. */
    private static List<string> Below1000(double n)
    {
        var parts = new List<string>();
        double h = Math.Floor(n / 100), t = Math.Floor(n % 100 / 10), o = n % 10;
        if (h > 0)
        {
            if (h > 1) parts.Add(ONES[(int)h]);
            parts.Add(N.Hundred);
        } // "yüz", not "bir yüz"
        if (t > 0) parts.Add(TENS[(int)t]);
        if (o > 0) parts.Add(ONES[(int)o]);
        return parts;
    }

    /** Non-negative integer → Azerbaijani words. */
    public static string NumberToWords(double n)
    {
        if (!double.IsFinite(n) || n < 0) return "";
        if (n == 0) return N.Zero;
        var groups = new List<double>();
        var x = Math.Floor(n);
        while (x > 0)
        {
            groups.Add(x % 1000);
            x = Math.Floor(x / 1000);
        }
        // Beyond the largest scale word — read digit-by-digit rather than dropping the magnitude.
        if (groups.Count > SCALES.Length)
        {
            // ⚠ `ONES[Number(d)] || N.zero` in the TS: a character the exponential rendering of a huge
            // double contributes ("e", "+") indexes with NaN and yields `undefined`, and `ONES[0]` is the
            // EMPTY STRING — both are falsy, so both read as `zero`. The bounds check reproduces that.
            var digits = Js.CodePoints(Js.NumberToString(Math.Floor(n))).Select(d =>
            {
                var idx = Js.Number(d);
                var w = double.IsInteger(idx) && idx >= 0 && idx < ONES.Length ? ONES[(int)idx] : "";
                return w.Length > 0 ? w : N.Zero;
            });
            return string.Join(" ", digits);
        }
        var parts = new List<string>();
        for (var g = groups.Count - 1; g >= 0; g--)
        {
            var v = groups[g];
            if (v == 0) continue;
            if (g == 1 && v == 1)
            {
                parts.Add(SCALES[1]);
                continue;
            } // "min", not "bir min"
            parts.AddRange(Below1000(v));
            if (g > 0) parts.Add(SCALES[g]);
        }
        return string.Join(" ", parts);
    }
}

/**
 * Turkish cardinal number → words (space-separated).
 * Ported from src/languages/turkish/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Turkish;

public static class TurkishNumbers
{
    private static TurkishNumbersDef N => Manifest.MANIFEST.Numbers;
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

    /** Non-negative integer → Turkish words. */
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
        var parts = new List<string>();
        for (var g = groups.Count - 1; g >= 0; g--)
        {
            var v = groups[g];
            if (v == 0) continue;
            if (g == 1 && v == 1)
            {
                parts.Add(SCALES[1]);
                continue;
            } // "bin", not "bir bin"
            parts.AddRange(Below1000(v));
            // ⚠ `SCALES[g]` IS AN OUT-OF-RANGE READ once the number outgrows the authored scale list (which
            // stops at katrilyon, 10¹⁵). The TS pushes the resulting `undefined` and `Array.join` renders it
            // as the EMPTY STRING, so `numberToWords(1e18)` is literally `"bir "` — trailing space and all.
            // C# would throw on the index, so the bound is explicit and pushes `""` to reproduce that string
            // exactly. ⚠ NOT FILTERED OUT: dropping the empty part would give `"bir"` and fork the two engines.
            if (g > 0) parts.Add(g < SCALES.Length ? SCALES[g] : "");
        }
        return string.Join(" ", parts);
    }
}

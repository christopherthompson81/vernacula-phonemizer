/**
 * Vietnamese cardinal number → words (space-separated syllables). Handles the common sound changes:
 * 5 in a unit slot after a ten → "lăm" (hai mươi lăm), 1 after a ten → "mốt" (hai mươi mốt), a zero tens slot
 * with a nonzero unit → "linh" (một trăm linh năm). Scales by thousands: nghìn / triệu / tỷ.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Vietnamese;

public static class VietnameseNumbers
{
    // Number words are authored DATA — consolidated in vietnamese.jsonc; the thousands-scale compositor is the algorithm.
    private static VietnameseNumbersDef N => Manifest.MANIFEST.Numbers;
    private static string[] ONES => N.Ones;
    private static string[] SCALES => N.Scales;

    /** 1 ≤ n < 1000 → words. `lead` = this group is not the most significant (force the hundreds slot). */
    private static List<string> Below1000(double n, bool lead)
    {
        double h = Math.Floor(n / 100), t = Math.Floor(n % 100 / 10), u = n % 10;
        var parts = new List<string>();
        if (h > 0 || lead)
        {
            parts.Add(ONES[(int)h]);
            parts.Add(N.Hundred);
        }
        if (t == 0)
        {
            if (u > 0 && (h > 0 || lead)) parts.Add(N.ZeroTens); // 105 → một trăm linh năm
            if (u > 0) parts.Add(ONES[(int)u]);
        }
        else
        {
            parts.Add(t == 1 ? N.Ten : ONES[(int)t]);
            if (t >= 2) parts.Add(N.TensMultiplier);
            if (u == 1 && t >= 2)
                parts.Add(N.UnitOneAfterTen); // 21 → hai mươi mốt
            else if (u == 5 && t >= 1)
                parts.Add(N.UnitFiveAfterTen); // 15/25 → mười/hai mươi lăm
            else if (u > 0) parts.Add(ONES[(int)u]);
        }
        return parts;
    }

    /** Non-negative integer → Vietnamese words. */
    public static string NumberToWords(double n)
    {
        if (!double.IsFinite(n) || n < 0) return "";
        if (n == 0) return ONES[0];
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
            if (groups[g] == 0) continue;
            parts.AddRange(Below1000(groups[g], g < groups.Count - 1));
            // ⚠ `SCALES[g]` IS AN OUT-OF-RANGE READ above the authored ladder (nghìn/triệu/tỷ, so 10¹²).
            // The TS pushes `undefined` and `Array.join` renders it as the EMPTY string, which the caller
            // then splits into an empty word that phonemizes to "". C# throws on the index, so the bound is
            // explicit and pushes "" to reproduce that exactly — NOT filtered out, for the reason the same
            // shape in Turkish records: dropping it would fork the engines on an input where both are
            // already past what the data can say.
            if (g > 0) parts.Add(g < SCALES.Length ? SCALES[g] : "");
        }
        return string.Join(" ", parts);
    }
}

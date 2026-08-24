/**
 * Spanish number → words (long scale: millón = 10⁶). The words then phonemize through the same g2p as any
 * other word, so digits read like written Spanish. Covers 0 … <10¹².
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Spanish;

public static class Numbers
{
    // Number words are authored DATA — consolidated in spanish.jsonc; the long-scale compositor is the algorithm.
    private static SpanishNumbers N => Manifest.MANIFEST.Numbers;
    private static IReadOnlyList<string> ONES => N.Ones;
    private static IReadOnlyList<string> TENS => N.Tens;
    private static IReadOnlyList<string> HUNDREDS => N.Hundreds;

    /** 0 ≤ n < 100 */
    private static string Below100(double n)
    {
        if (n < 30) return ONES[(int)n];
        int t = (int)Math.Floor(n / 10), u = (int)(n % 10);
        return u == 0 ? TENS[t] : $"{TENS[t]} {N.Connector} {ONES[u]}";
    }

    /** 1 ≤ n < 1000 */
    private static string Below1000(double n)
    {
        if (n == 100) return N.HundredExact;
        int h = (int)Math.Floor(n / 100);
        double r = n % 100;
        var parts = new List<string>();
        if (h != 0) parts.Add(HUNDREDS[h]);
        if (r != 0) parts.Add(Below100(r));
        return string.Join(" ", parts);
    }

    /** 1 ≤ n < 10⁶ */
    private static string Below1e6(double n)
    {
        if (n < 1000) return Below1000(n);
        double th = Math.Floor(n / 1000), r = n % 1000;
        var thousand = th == 1 ? N.Thousand : $"{Below1000(th)} {N.Thousand}";
        return r != 0 ? $"{thousand} {Below1000(r)}" : thousand;
    }

    /** Non-negative integer → Spanish words. Out-of-range / unsafe values read digit-by-digit (never empty). */
    public static string NumberToWords(double n)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e18)
            return string.Join(" ", Js.NumberToString(Math.Abs(n))
                .Select(d => d >= '0' && d <= '9' ? ONES[d - '0'] : d.ToString()));
        if (n == 0) return ONES[0];
        if (n < 1e6) return Below1e6(n);
        foreach (var sc in N.Scales)
        {
            if (n < sc.Value) continue;
            double q = Math.Floor(n / sc.Value), r = n % sc.Value;
            var head = q == 1 ? sc.One : $"{Below1e6(q)} {sc.Many}";
            return r != 0 ? $"{head} {NumberToWords(r)}" : head;
        }
        return Below1e6(n); // unreachable (n ≥ 1e6 matched a scale)
    }
}

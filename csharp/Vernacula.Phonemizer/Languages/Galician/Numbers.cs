/**
 * Galician number → words (standard RAG cardinals).
 * Ported from src/languages/galician/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Galician;

public static class Numbers
{
    private static GalicianNumbers N => Manifest.MANIFEST.Numbers;
    private static IReadOnlyList<string> ONES => N.Ones;
    private static IReadOnlyList<string> TENS => N.Tens;
    private static IReadOnlyList<string> HUNDREDS => N.Hundreds;

    /** 0 ≤ n < 100. 0..19 are single words; 20+ join tens + units with "e" (vinte e un). */
    private static string Below100(double n)
    {
        if (n < 20) return ONES[(int)n];
        int t = (int)Math.Floor(n / 10), u = (int)(n % 10);
        return u == 0 ? TENS[t] : $"{TENS[t]} {N.Connector} {ONES[u]}";
    }

    /** 1 ≤ n < 1000. Exactly 100 = cen; else cento/-centos + remainder. */
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

    /** Non-negative integer → Galician words (long scale: millón = 10⁶, billón = 10¹²; 10⁹ = "mil millóns").
     *  Out-of-range / unsafe values read digit-by-digit (never empty). */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e18)
            return string.Join(" ", (raw ?? Js.NumberToString(Math.Abs(n)))
                .Select(d => d >= '0' && d <= '9' ? ONES[d - '0'] : d.ToString()));
        if (n == 0) return ONES[0];
        if (n < 1e6) return Below1e6(n);
        if (n < 1e12)
        {
            // 10⁶ … <10¹²: the millóns band. 10⁹ falls out naturally as "mil millóns" (below1e6(1000) = "mil").
            double mil = Math.Floor(n / 1e6), r = n % 1e6;
            var head = mil == 1 ? N.Million.One : $"{Below1e6(mil)} {N.Million.Many}";
            return r != 0 ? $"{head} {NumberToWords(r)}" : head;
        }
        // 10¹² … <10¹⁸: the billóns band (long scale).
        double bil = Math.Floor(n / 1e12), r0 = n % 1e12;
        var head0 = bil == 1 ? N.Billion.One : $"{Below1e6(bil)} {N.Billion.Many}";
        return r0 != 0 ? $"{head0} {NumberToWords(r0)}" : head0;
    }
}

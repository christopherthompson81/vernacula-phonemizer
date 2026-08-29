/**
 * Aragonese cardinal number → words.
 * Ported from src/languages/aragonese/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Aragonese;

public static class Numbers
{
    private static AragoneseNumbersDef N => Manifest.MANIFEST.Numbers;
    private static IReadOnlyList<string> ONES => N.Ones;
    private static IReadOnlyList<string> TENS => N.Tens;
    private static IReadOnlyList<string> HUNDREDS => N.Hundreds;

    /** 0 ≤ n < 100. The twenties are FUSED single words; 30–90 take the ⟨y⟩ connector. */
    private static string Below100(double n)
    {
        if (n < 20) return ONES[(int)n];
        int t = (int)Math.Floor(n / 10), u = (int)(n % 10);
        if (u == 0) return TENS[t];
        return t == 2 ? N.Twenties[u] : $"{TENS[t]} {N.And} {ONES[u]}";
    }

    /** 1 ≤ n < 1000. cient / docientos … + the remainder (101 → cient un). */
    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        int h = (int)Math.Floor(n / 100);
        double r = n % 100;
        return r != 0 ? $"{HUNDREDS[h]} {Below100(r)}" : HUNDREDS[h];
    }

    /** 1 ≤ n < 10⁶. mil is invariable and drops its "un" (1000 → mil, 2000 → dos mil). */
    private static string Below1e6(double n)
    {
        if (n < 1000) return Below1000(n);
        double th = Math.Floor(n / 1000), r = n % 1000;
        var thousand = th == 1 ? N.Thousand : $"{Below1000(th)} {N.Thousand}";
        return r != 0 ? $"{thousand} {Below1000(r)}" : thousand;
    }

    /** Non-negative integer → Aragonese words. Out-of-range / unsafe values read digit-by-digit (never empty). */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e12)
            return string.Join(" ", (raw ?? Js.NumberToString(Math.Abs(n))).Select(d =>
                d >= '0' && d <= '9' && d - '0' < ONES.Count ? ONES[d - '0'] : d.ToString()));
        if (n == 0) return ONES[0]; // zero
        if (n < 1e6) return Below1e6(n);
        foreach (var sc in N.Scales)
        {
            if (n < sc.Value) continue;
            double q = Math.Floor(n / sc.Value), r = n % sc.Value;
            // millón is a NOUN: it keeps the "un" (un millón) and pluralises (dos millons). With only the
            // 10⁶ scale authored, 10⁹ composes as the Ibero-Romance long-scale "mil millons".
            var head = q == 1 ? sc.One : $"{Below1e6(q)} {sc.Many}";
            return r != 0 ? $"{head} {NumberToWords(r)}" : head;
        }
        return Below1e6(n); // unreachable (n ≥ 10⁶ matched the scale)
    }
}

/**
 * Catalan number → words (cardinals, masculine). Emits SPACE-separated words so each reads through the g2p.
 * Ported from src/languages/catalan/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Catalan;

public static class Numbers
{
    private static CatalanNumbers N => Manifest.MANIFEST.Numbers;
    private static IReadOnlyList<string> ONES => N.Ones;
    private static IReadOnlyList<string> TENS => N.Tens;
    private static IReadOnlyList<string> HUNDREDS => N.Hundreds;

    /** 1 ≤ n < 100. 20s take the -i- connector (vint-i-un); 30–90 juxtapose (trenta-un). */
    private static string Below100(double n)
    {
        if (n < 20) return ONES[(int)n];
        int t = (int)Math.Floor(n / 10), u = (int)(n % 10);
        if (u == 0) return TENS[t];
        var conn = t == 2 ? $" {N.And} " : " ";
        return $"{TENS[t]}{conn}{ONES[u]}";
    }

    /** 1 ≤ n < 1000. cent / dos-cents … + remainder. */
    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        int h = (int)Math.Floor(n / 100);
        double r = n % 100;
        var hundred = HUNDREDS[h];
        return r != 0 ? $"{hundred} {Below100(r)}" : hundred;
    }

    /** Non-negative integer (< 10⁹) → Catalan words; larger / non-finite → digit-by-digit. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e9)
            return string.Join(" ", Js.CodePoints(raw ?? Js.NumberToString(Math.Abs(n))).Select(d =>
            {
                // JS `ONES[Number(d)] ?? d`: a non-digit gives NaN and falls through to the character.
                var idx = Js.Number(d);
                return double.IsInteger(idx) && idx >= 0 && idx < ONES.Count ? ONES[(int)idx] : d;
            }));
        if (n == 0) return ONES[0]; // zero
        if (n < 1000) return Below1000(n);
        var parts = new List<string>();
        double mil = Math.Floor(n / 1e6), th = Math.Floor(n % 1e6 / 1000), r = n % 1000;
        if (mil != 0) parts.Add(mil == 1 ? N.Million.Sg : $"{Below1000(mil)} {N.Million.Pl}");
        if (th != 0) parts.Add(th == 1 ? N.Thousand : $"{Below1000(th)} {N.Thousand}"); // mil, dos mil
        if (r != 0) parts.Add(Below1000(r));
        return string.Join(" ", parts);
    }
}

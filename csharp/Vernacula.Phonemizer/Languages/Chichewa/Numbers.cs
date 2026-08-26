/**
 * Chichewa cardinal number → words (space-separated; each runs through the g2p). 0 … <10¹²; larger or
 * non-finite falls back to digit-by-digit.
 * Ported from src/languages/chichewa/numbers.ts — see that file for the noun-class concord evidence
 * behind the two unit series and for why 10¹² is the ceiling.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Chichewa;

public static class Numbers
{
    private static ChichewaNumbersDef N => Manifest.MANIFEST.Numbers;

    /** 1 ≤ n < 100; `series` supplies the UNIT slot's concord. The tens multiplier is always class-6. */
    private static string Below100(double n, IReadOnlyList<string> series)
    {
        if (n < 10) return series[(int)n];
        if (n == 10) return N.Ten;
        var t = Math.Floor(n / 10);
        var u = n % 10;
        var tens = t == 1 ? N.Ten : $"{N.Tens} {N.ClassSix[(int)t]}";
        return u != 0 ? $"{tens} {N.And} {series[(int)u]}" : tens;
    }

    /** 1 ≤ n < 1000. */
    private static string Below1000(double n, IReadOnlyList<string> series)
    {
        if (n < 100) return Below100(n, series);
        var h = Math.Floor(n / 100);
        var r = n % 100;
        var hundred = h == 1 ? N.Hundred : $"{N.Hundreds} {N.ClassSix[(int)h]}";
        return r != 0 ? $"{hundred} {N.And} {Below100(r, series)}" : hundred;
    }

    /** A class-9 loan magnitude (miliyoni / biliyoni). 1 ≤ count < 1000. */
    private static string LoanMagnitude(double count, string singular, string plural) =>
        count == 1 ? $"{singular} {N.ClassNineOne}" : $"{plural} {Below1000(count, N.ClassSix)}";

    /** Non-negative integer (< 10¹²) → Chichewa words; larger / non-finite → digit-by-digit. */
    public static string NumberToWords(double n)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e12)
            return string.Join(" ", Js.CodePoints(Js.NumberToString(Math.Abs(n))).Select(d =>
            {
                // JS `N.units[Number(d)] ?? d`: a non-digit code point (the `e`/`+` of an exponential
                // String(n), a `.`) indexes with NaN, misses, and falls back to the character itself.
                var i = Js.Number(d);
                return double.IsInteger(i) && i >= 0 && i < N.Units.Length ? N.Units[(int)i] : d;
            }));
        if (n == 0) return N.Units[0];
        var b = Math.Floor(n / 1e9);
        var m = Math.Floor(n / 1e6) % 1000;
        var th = Math.Floor(n / 1000) % 1000;
        var r = n % 1000;
        var parts = new List<string>();
        if (b != 0) parts.Add(LoanMagnitude(b, N.Billion, N.Billions));
        if (m != 0) parts.Add(LoanMagnitude(m, N.Million, N.Millions));
        if (th != 0) parts.Add(th == 1 ? N.Thousand : $"{N.Thousands} {Below1000(th, N.Units)}");
        if (r != 0) parts.Add(Below1000(r, N.Units));
        return string.Join($" {N.And} ", parts);
    }
}

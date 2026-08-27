/**
 * Kurmanji cardinal number → words (space-separated; each runs through the g2p), joined with "û".
 * Ported from src/languages/kurmanji/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kurmanji;

public static class KurmanjiNumbers
{
    private static KurmanjiNumbersDef N => Manifest.MANIFEST.Numbers;

    /** 1 ≤ n < 100 (tens û units). */
    private static string Below100(double n)
    {
        if (n < 10) return N.Units[(int)n];
        if (n < 20) return N.Teens[(int)n - 10];
        double t = Math.Floor(n / 10), u = n % 10;
        return u == 0 ? N.Tens[(int)t] : $"{N.Tens[(int)t]} {N.Connector} {N.Units[(int)u]}";
    }

    /** 1 ≤ n < 1000 (du sed û bîst). */
    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        double h = Math.Floor(n / 100), r = n % 100;
        var hundred = h == 1 ? N.Hundred : $"{N.Units[(int)h]} {N.Hundred}";
        return r != 0 ? $"{hundred} {N.Connector} {Below100(r)}" : hundred;
    }

    /** Non-negative integer (< 10⁹) → Kurmanji words; larger / non-finite → digit-by-digit. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e9)
        {
            var src = raw ?? Js.NumberToString(Math.Abs(n));
            // JS `N.units[Number(d)] ?? d`: a non-digit indexes the array out of range and falls through.
            return string.Join(" ", Js.CodePoints(src).Select(d =>
            {
                var i = Js.Number(d);
                return double.IsInteger(i) && i >= 0 && i < N.Units.Length ? N.Units[(int)i] : d;
            }));
        }
        if (n == 0) return N.Units[0]; // sifir
        var parts = new List<string>();
        double mil = Math.Floor(n / 1e6), th = Math.Floor(n % 1e6 / 1000), r = n % 1000;
        if (mil != 0) parts.Add($"{(mil == 1 ? N.Units[1] : Below1000(mil))} {N.Million}");
        if (th != 0) parts.Add(th == 1 ? N.Thousand : $"{Below1000(th)} {N.Thousand}");
        if (r != 0) parts.Add(Below1000(r));
        return string.Join($" {N.Connector} ", parts);
    }
}

/**
 * Swedish number → words (cardinals), tens-first compounds, split at the thousand/million boundaries.
 * Ported from src/languages/swedish/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Swedish;

public static class Numbers
{
    private static SwedishNumbersDef N => Manifest.MANIFEST.Numbers;
    private static string[] ONES => N.Ones;
    private static string[] TENS => N.Tens;

    /** JS reads an out-of-range array index as `undefined`; every site below that can do so goes through here. */
    private static string? At(string[] xs, double i) =>
        double.IsInteger(i) && i >= 0 && i < xs.Length ? xs[(int)i] : null;

    /** 1 ≤ n < 100 (compounded, tens-first: tjugoett). */
    private static string Below100(double n)
    {
        if (n < 20) return At(ONES, n)!;
        double t = Math.Floor(n / 10), u = n % 10;
        return u == 0 ? At(TENS, t)! : $"{At(TENS, t)}{At(ONES, u)}";
    }

    /** 1 ≤ n < 1000 (etthundra­tjugotre). */
    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        double h = Math.Floor(n / 100), r = n % 100;
        var hundred = $"{At(ONES, h)}{N.Hundred}";
        return r != 0 ? $"{hundred}{Below100(r)}" : hundred;
    }

    /** Non-negative integer (&lt; 10⁹) → Swedish words; larger / non-finite → digit-by-digit. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e9)
            return string.Join(" ", Js.CodePoints(raw ?? Js.NumberToString(Math.Abs(n)))
                .Select(d => At(ONES, Js.Number(d)) ?? d));
        if (n == 0) return ONES[0]; // noll
        if (n < 1000) return Below1000(n);
        var parts = new List<string>();
        double mil = Math.Floor(n / 1e6), th = Math.Floor(n % 1e6 / 1000), r = n % 1000;
        if (mil != 0) parts.Add(mil == 1 ? N.Million.Sg : $"{Below1000(mil)} {N.Million.Pl}");
        if (th != 0)
        {
            var t = Below1000(th); // ett+tusen elides to ettusen (tjugoett+tusen → tjugoettusen)
            parts.Add((t.EndsWith("ett", StringComparison.Ordinal) ? t[..^1] : t) + N.Thousand);
        }
        if (r != 0) parts.Add(Below1000(r));
        return string.Join(" ", parts);
    }
}

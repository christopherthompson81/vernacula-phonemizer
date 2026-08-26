/**
 * Somali cardinal number → words: units-first within 1-99 (kow iyo labaatan), hundreds/thousands first.
 * Ported from src/languages/somali/numbers.ts — see that file for the composition rules.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Somali;

public static class Numbers
{
    private static SomaliNumbersDef N => Manifest.MANIFEST.Numbers;
    private static string[] ONES => N.Ones;
    private static string[] TENS => N.Tens;

    /** 1 ≤ n < 100 (units-first: kow iyo labaatan). */
    private static string Below100(double n)
    {
        if (n < 10) return ONES[(int)n];
        double t = Math.Floor(n / 10), o = n % 10;
        if (o == 0) return TENS[(int)t];
        return $"{ONES[(int)o]} {N.Connector} {TENS[(int)t]}";
    }

    /** 1 ≤ n < 1000 (hundreds first: laba boqol iyo …). */
    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        double h = Math.Floor(n / 100), r = n % 100;
        var hundred = h == 1 ? N.Hundred : $"{ONES[(int)h]} {N.Hundred}";
        return r != 0 ? $"{hundred} {N.Connector} {Below100(r)}" : hundred;
    }

    /** Non-negative integer (< 10⁹) → Somali words; larger / non-finite → digit-by-digit. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e9)
            return string.Join(" ", Js.CodePoints((raw ?? Js.NumberToString(Math.Abs(n)))).Select(d =>
            {
                // `ONES[Number(d)] ?? d` — a non-digit character (the "." of a fraction, the "e" of an
                // exponent form) indexes with NaN in JS and falls through to the character itself.
                var k = Js.Number(d);
                return double.IsInteger(k) && k >= 0 && k < ONES.Length ? ONES[(int)k] : d;
            }));
        if (n == 0) return ONES[0]; // eber
        if (n < 1000) return Below1000(n);
        if (n < 1e6)
        {
            double th = Math.Floor(n / 1000), r = n % 1000;
            var thousand = th == 1 ? N.Thousand : $"{Below1000(th)} {N.Thousand}";
            return r != 0 ? $"{thousand} {N.Connector} {Below1000(r)}" : thousand;
        }
        double mil = Math.Floor(n / 1e6), rem = n % 1e6;
        var million = $"{Below1000(mil)} {N.Million}";
        return rem != 0 ? $"{million} {N.Connector} {NumberToWords(rem)}" : million;
    }
}

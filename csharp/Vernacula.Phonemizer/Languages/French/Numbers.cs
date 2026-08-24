/**
 * French number → words (standard/France, vigesimal 70/80/90).
 * Ported from src/languages/french/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.French;

public static class Numbers
{
    private static IReadOnlyList<string> SMALL => Manifest.MANIFEST.Numbers.Small;
    private static IReadOnlyList<string> TENS => Manifest.MANIFEST.Numbers.Tens;
    private static FrenchMagnitudes MAG => Manifest.MANIFEST.Numbers.Magnitudes;

    /** 0 ≤ n < 100 */
    private static string Below100(int n)
    {
        if (n < 20) return SMALL[n];
        if (n < 60)
        {
            int t = n / 10, u = n % 10;
            if (u == 0) return TENS[t];
            if (u == 1) return $"{TENS[t]}-et-un";
            return $"{TENS[t]}-{SMALL[u]}";
        }
        if (n < 80)
        {
            var r0 = n - 60;
            if (r0 == 0) return MAG.Sixty;
            if (r0 == 1) return $"{MAG.Sixty}-et-un";
            if (r0 == 11) return $"{MAG.Sixty}-et-onze";
            return $"{MAG.Sixty}-{SMALL[r0]}";
        }
        var r = n - 80; // 80–99: quatre-vingt(s) + 0..19
        return r == 0 ? $"{MAG.Eighty}s" : $"{MAG.Eighty}-{SMALL[r]}";
    }

    /** 1 ≤ n < 1000 */
    private static string Below1000(int n)
    {
        if (n < 100) return Below100(n);
        int h = n / 100, r = n % 100;
        var hundred =
            h == 1
                ? MAG.Hundred
                : $"{SMALL[h]} {MAG.Hundred}{(r == 0 ? "s" : "")}"; // deux cents, deux cent un
        return r != 0 ? $"{hundred} {Below100(r)}" : hundred;
    }

    /** Non-negative integer (< 10⁹) → French words; larger / non-finite → digit-by-digit. */
    public static string NumberToWords(double n)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e9)
            return string.Join(" ", Js.NumberToString(Math.Abs(n))
                .Select(d => d >= '0' && d <= '9' ? SMALL[d - '0'] : d.ToString()));
        var v = (int)n;
        if (v == 0) return SMALL[0]; // zéro
        if (v < 1000) return Below1000(v);
        if (v < 1_000_000)
        {
            int th = v / 1000, r0 = v % 1000;
            var thousand = th == 1 ? MAG.Thousand : $"{Below1000(th)} {MAG.Thousand}";
            return r0 != 0 ? $"{thousand} {Below1000(r0)}" : thousand;
        }
        int m = v / 1_000_000, r = v % 1_000_000;
        var million = m == 1 ? $"un {MAG.Million}" : $"{Below1000(m)} {MAG.Millions}";
        return r != 0 ? $"{million} {NumberToWords(r)}" : million;
    }
}

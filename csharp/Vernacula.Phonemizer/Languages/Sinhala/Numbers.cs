/**
 * Sinhala (si) cardinal number compositor — the analytic multiplier form for every magnitude ≥100.
 * Ported from src/languages/sinhala/numbers.ts — see that file for the sourcing of the forms.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Sinhala;

public static class Numbers
{
    private static SinhalaNumbers N => Manifest.MANIFEST.Numbers;

    /** A non-negative integer → space-separated Sinhala cardinal words. */
    public static string NumberToWords(double n)
    {
        if (n < 0 || double.IsNaN(n) || double.IsInfinity(n)) return "";
        n = Math.Floor(n);
        if (n < 10) return N.Units[(int)n];
        if (n < 20) return N.Teens[(int)n - 10];
        if (n < 100)
        {
            var t = Math.Floor(n / 10);
            var u = n % 10;
            return u == 0
                ? N.TensWord[Js.NumberToString(t)]
                : N.TensStem[Js.NumberToString(t)] + N.Units[(int)u];
        }

        var nn = n;
        string Compose(double count, string magnitude, double unit)
        {
            var head = count == 1 ? magnitude : $"{NumberToWords(count)} {magnitude}";
            var rest = nn % unit;
            return rest == 0 ? head : $"{head} {NumberToWords(rest)}";
        }

        var m = N.Magnitudes;
        if (n < 1000) return Compose(Math.Floor(n / 100), m.Hundred, 100);
        if (n < 100000) return Compose(Math.Floor(n / 1000), m.Thousand, 1000);
        if (n < 10000000) return Compose(Math.Floor(n / 100000), m.Lakh, 100000);
        return Compose(Math.Floor(n / 1000000), m.Million, 1000000);
    }
}

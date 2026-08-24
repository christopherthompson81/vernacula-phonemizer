/**
 * Hausa cardinal number → words.
 * Ported from src/languages/hausa/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hausa;

public static class HausaNumbers
{
    private static HausaNumbersDef N => Manifest.MANIFEST.Numbers;
    private static string[] ONES => N.Ones;
    private static string[] TENS => N.Tens;

    private static List<string> Below100(double n)
    {
        if (n < 10) return n == 0 ? new List<string>() : new List<string> { ONES[(int)n] };
        if (n < 20)
            return n == 10
                ? new List<string> { TENS[1] }
                : new List<string> { TENS[1], N.TeensConnector, ONES[(int)n - 10] }; // 11–19: goma sha X
        double t = Math.Floor(n / 10), u = n % 10;
        return u == 0
            ? new List<string> { TENS[(int)t] }
            : new List<string> { TENS[(int)t], N.Connector, ONES[(int)u] };
    }

    private static List<string> Below1000(double n)
    {
        double h = Math.Floor(n / 100), r = n % 100;
        var parts = new List<string>();
        if (h > 0)
        {
            parts.Add(N.Hundred);
            if (h > 1) parts.Add(ONES[(int)h]);
        }
        if (r > 0)
        {
            if (h > 0) parts.Add(N.Connector);
            parts.AddRange(Below100(r));
        }
        return parts;
    }

    /** Non-negative integer → Hausa words. */
    public static string NumberToWords(double n)
    {
        if (!double.IsFinite(n) || n < 0 || n >= 1e12) return "";
        if (n == 0) return ONES[0]; // sifili
        // Magnitude-first, largest scale first — Hausa says the scale word then its multiplier (dubu biyu =
        // 2 000). Each scale consumes its own decade band and recurses on the rest.
        var SCALES = new (double Value, string Scale)[]
        {
            (1_000_000_000d, N.Billion), (1_000_000d, N.Million), (1000d, N.Thousand),
        };
        foreach (var (value, scale) in SCALES)
        {
            if (n >= value)
            {
                double q = Math.Floor(n / value), rest = n % value;
                var parts = new List<string> { scale };
                if (q > 1) parts.AddRange(NumberToWords(q).Split(' ')); // the multiplier follows its scale word
                if (rest > 0) { parts.Add(N.Connector); parts.AddRange(NumberToWords(rest).Split(' ')); }
                return string.Join(" ", parts);
            }
        }
        return string.Join(" ", Below1000(n));
    }
}

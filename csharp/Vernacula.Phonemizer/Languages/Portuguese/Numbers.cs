/**
 * Portuguese number → words (European convention).
 * Ported from src/languages/portuguese/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Portuguese;

public static class Numbers
{
    private static PortugueseNumberData N => Manifest.MANIFEST.Numbers;
    private static IReadOnlyList<string> TENS => N.Tens;
    private static IReadOnlyList<string> HUNDREDS => N.Hundreds;
    private static string E => N.Connector; // "e"

    private static readonly IReadOnlyDictionary<int, string> SMALL_BP = new Dictionary<int, string>
    {
        [16] = "dezesseis",
        [17] = "dezessete",
        [19] = "dezenove",
    };

    private static string Small(int i, string dialect) =>
        (dialect == "bp" ? SMALL_BP.GetValueOrDefault(i) : null) ?? N.Small[i];

    /** 0 ≤ n < 100 */
    private static string Below100(int n, string dialect)
    {
        if (n < 20) return Small(n, dialect);
        int t = n / 10, u = n % 10;
        return u == 0 ? TENS[t] : $"{TENS[t]} {E} {Small(u, dialect)}";
    }

    /** 1 ≤ n < 1000 */
    private static string Below1000(int n, string dialect)
    {
        if (n < 100) return Below100(n, dialect);
        if (n == 100) return N.HundredExact;
        int h = n / 100, r = n % 100;
        return r != 0 ? $"{HUNDREDS[h]} {E} {Below100(r, dialect)}" : HUNDREDS[h];
    }

    /** Non-negative integer (< 10⁹) → Portuguese words (`dialect`: European default, Brazilian teens for "bp");
     *  larger / non-finite → digit-by-digit. */
    public static string NumberToWords(double n, string dialect = "ep", string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e9)
            return string.Join(" ", (raw ?? Js.NumberToString(Math.Abs(n)))
                .Select(d => d >= '0' && d <= '9' ? Small(d - '0', dialect) : d.ToString()));
        var v = (int)n;
        if (v < 1000) return Below1000(v, dialect);
        if (v < 1_000_000)
        {
            int th = v / 1000, r0 = v % 1000;
            var thousand = th == 1 ? N.Thousand : $"{Below1000(th, dialect)} {N.Thousand}";
            if (r0 == 0) return thousand;
            return r0 < 100 || r0 % 100 == 0
                ? $"{thousand} {E} {Below1000(r0, dialect)}"
                : $"{thousand} {Below1000(r0, dialect)}";
        }
        int m = v / 1_000_000, r = v % 1_000_000;
        var million = m == 1
            ? $"{Small(1, dialect)} {N.Million}"
            : $"{Below1000(m, dialect)} {N.MillionPlural}";
        if (r == 0) return million;
        return r < 100 || r % 100 == 0
            ? $"{million} {E} {NumberToWords(r, dialect)}"
            : $"{million} {NumberToWords(r, dialect)}";
    }
}

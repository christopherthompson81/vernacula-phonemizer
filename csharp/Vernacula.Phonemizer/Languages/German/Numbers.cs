/**
 * German number → words (cardinals). German writes numbers as single compound words with units before tens
 * (einundzwanzig). Output is space-separated at the thousand/million boundaries so each chunk reads through the
 * g2p; within a chunk it stays compounded. Covers 0 … <10⁹.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.German;

public static class Numbers
{
    // Number words are authored DATA — consolidated in german.jsonc; the composition logic below is the algorithm.
    private static GermanNumberData N => Manifest.MANIFEST.Numbers;
    private static IReadOnlyList<string> ONES => N.Ones;
    private static IReadOnlyList<string> TENS => N.Tens;

    /** 1 ≤ n < 100 (compounded: einundzwanzig). */
    private static string Below100(int n)
    {
        if (n < 20) return ONES[n];
        int t = n / 10, u = n % 10;
        if (u == 0) return TENS[t];
        var unit = u == 1 ? N.CompoundOne : ONES[u]; // "ein" in compounds (einundzwanzig)
        return $"{unit}{N.Connector}{TENS[t]}";
    }

    /** 1 ≤ n < 1000 (compounded: einhundertdreiundzwanzig). */
    private static string Below1000(int n)
    {
        if (n < 100) return Below100(n);
        int h = n / 100, r = n % 100;
        var hundred = $"{(h == 1 ? N.CompoundOne : ONES[h])}{N.Hundred}";
        return r != 0 ? $"{hundred}{Below100(r)}" : hundred;
    }

    /** Non-negative integer (< 10⁹) → German words; larger / non-finite → digit-by-digit. */
    public static string NumberToWords(double n)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e9)
            return string.Join(" ", Js.NumberToString(Math.Abs(n))
                .Select(d => d >= '0' && d <= '9' ? ONES[d - '0'] : d.ToString()));
        var v = (int)n;
        if (v == 0) return ONES[0]; // null
        if (v < 1000) return Below1000(v);
        var parts = new List<string>();
        int mil = v / 1_000_000, th = (v % 1_000_000) / 1000, r = v % 1000;
        if (mil != 0)
            parts.Add(mil == 1 ? N.Million.Sg : $"{Below1000(mil)} {N.Million.Pl}");
        if (th != 0)
            parts.Add($"{(th == 1 ? N.CompoundOne : Below1000(th))}{N.Thousand}");
        if (r != 0) parts.Add(Below1000(r));
        return string.Join(" ", parts);
    }
}

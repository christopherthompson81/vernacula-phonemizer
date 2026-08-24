/**
 * Japanese number → kana reading (Sino-Japanese counting), handling the common sound changes: 300 さんびゃく,
 * 600 ろっぴゃく, 800 はっぴゃく, 3000 さんぜん, 8000 はっせん, 一 in higher units dropped where idiomatic.
 * Covers 0 … <10¹⁶ (万/億/兆 grouping). The caller feeds the kana through kanaToIpa.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Japanese;

public static class Numbers
{
    // Number words are authored DATA — consolidated in japanese.jsonc; the group compositor below is the algorithm.
    private static JapaneseNumberData N => Manifest.MANIFEST.Numbers;
    private static IReadOnlyList<string> ONES => N.Ones;
    private static IReadOnlyList<string> HUND => N.Hundreds;
    private static IReadOnlyList<string> THOU => N.Thousands;
    private static IReadOnlyList<string> UNITS => N.MyriadUnits;

    /** 1 ≤ n < 10000 → kana. */
    private static string Below10000(int n)
    {
        var s = "";
        int th = n / 1000, h = (n % 1000) / 100, t = (n % 100) / 10, u = n % 10;
        s += THOU[th];
        s += HUND[h];
        if (t == 1) s += N.Ten;
        else if (t >= 2) s += ONES[t] + N.Ten;
        s += ONES[u];
        return s;
    }

    /** Non-negative integer → kana (万/億/兆 groups). 0 → れい; too large → digit-by-digit. */
    public static string NumberToKana(double n)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0)
            return string.Concat(Js.NumberToString(Math.Abs(n))
                .Select(d =>
                {
                    var idx = d >= '0' && d <= '9' ? d - '0' : -1;
                    var w = idx >= 0 && idx < ONES.Count ? ONES[idx] : "";
                    return w.Length > 0 ? w : N.Zero; // TS `ONES[Number(d)] || N.zero`
                }));
        if (n == 0) return N.Zero;
        var groups = new List<int>();
        var x = (long)n;
        while (x > 0)
        {
            groups.Add((int)(x % 10000));
            x /= 10000;
        }
        var @out = "";
        for (var g = groups.Count - 1; g >= 0; g--)
        {
            if (groups[g] == 0) continue;
            @out += Below10000(groups[g]) + (g < UNITS.Count ? UNITS[g] : "");
        }
        return @out;
    }
}

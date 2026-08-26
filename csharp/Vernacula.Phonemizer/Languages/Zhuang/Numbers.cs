/**
 * Zhuang cardinal number → words (space-separated; each word runs through the g2p). The series is
 * MYRIAD-grouped like Chinese (cib 10 · bak 10² · cien 10³ · fanh 10⁴ · ik 10⁸) with a spoken `lingz` zero.
 * Ported from src/languages/zhuang/numbers.ts — see that file for the sourcing of every word and branch.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Zhuang;

public static class ZhuangNumberWords
{
    private static ZhuangNumbers N => Manifest.MANIFEST.Numbers;

    /** The four places of one myriad group, largest first. `""` is the bare units place. */
    private static readonly (double Place, Func<string> Scale)[] PLACES =
    {
        (1000, () => N.Thousand),
        (100, () => N.Hundred),
        (10, () => N.Ten),
        (1, () => ""),
    };

    /** 1 ≤ n &lt; 10⁴ → the words of one myriad group; `bound` = a higher magnitude has already been spoken. */
    private static string Group(double n, bool bound)
    {
        var @out = new List<string>();
        var started = false;
        var gap = false;
        foreach (var (place, scale) in PLACES)
        {
            var d = (int)(Math.Floor(n / place) % 10);
            if (d == 0)
            {
                if (started || bound) gap = true;
                continue;
            }
            if (gap) @out.Add(N.Units[0]);
            gap = false;
            if (place == 10 && d == 1 && !started && !bound) @out.Add(N.Ten);
            else
            {
                var s = scale();
                @out.Add(s != "" ? $"{N.Units[d]} {s}" : N.Units[d]);
            }
            started = true;
        }
        return string.Join(" ", @out);
    }

    /** Non-negative integer (&lt; 10¹²) → Zhuang words; larger / non-finite → digit-by-digit. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!(double.IsFinite(n) && n == Math.Floor(n) && Math.Abs(n) <= 9007199254740991.0) || n < 0 || n >= 1e12)
        {
            var digits = Js.CodePoints((raw ?? Js.NumberToString(Math.Abs(n))))
                .Select(d =>
                {
                    // JS `N.units[Number(d)] ?? d`: a non-digit character (the `.`/`e`/`+` of an
                    // exponential form) indexes with NaN, misses, and falls through to the character.
                    var i = Js.Number(d);
                    return !double.IsNaN(i) && i == Math.Floor(i) && i >= 0 && i < N.Units.Count
                        ? N.Units[(int)i]
                        : d;
                });
            return string.Join(" ", digits);
        }
        if (n == 0) return N.Units[0];

        var yi = Math.Floor(n / 1e8);
        var wan = Math.Floor(n % 1e8 / 1e4);
        var lo = n % 1e4;
        var @out = new List<string>();
        var bound = false;
        if (yi != 0)
        {
            @out.Add($"{Group(yi, false)} {N.HundredMillion}");
            bound = true;
        }
        if (wan != 0)
        {
            @out.Add($"{Group(wan, bound)} {N.Myriad}");
            bound = true;
        }
        if (lo != 0) @out.Add(Group(lo, bound));
        return string.Join(" ", @out);
    }
}

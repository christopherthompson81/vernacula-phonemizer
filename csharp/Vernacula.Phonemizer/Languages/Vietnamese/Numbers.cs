/**
 * Vietnamese cardinal number → words (space-separated syllables).
 * Ported from src/languages/vietnamese/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Vietnamese;

public static class VietnameseNumbers
{
    private static VietnameseNumbersDef N => Manifest.MANIFEST.Numbers;
    private static string[] ONES => N.Ones;
    private static string[] SCALES => N.Scales;

    /** 1 ≤ n < 1000 → words. `lead` = this group is not the most significant (force the hundreds slot). */
    private static List<string> Below1000(double n, bool lead)
    {
        double h = Math.Floor(n / 100), t = Math.Floor(n % 100 / 10), u = n % 10;
        var parts = new List<string>();
        if (h > 0 || lead)
        {
            parts.Add(ONES[(int)h]);
            parts.Add(N.Hundred);
        }
        if (t == 0)
        {
            if (u > 0 && (h > 0 || lead)) parts.Add(N.ZeroTens); // 105 → một trăm linh năm
            if (u > 0) parts.Add(ONES[(int)u]);
        }
        else
        {
            parts.Add(t == 1 ? N.Ten : ONES[(int)t]);
            if (t >= 2) parts.Add(N.TensMultiplier);
            if (u == 1 && t >= 2)
                parts.Add(N.UnitOneAfterTen); // 21 → hai mươi mốt
            else if (u == 5 && t >= 1)
                parts.Add(N.UnitFiveAfterTen); // 15/25 → mười/hai mươi lăm
            else if (u > 0) parts.Add(ONES[(int)u]);
        }
        return parts;
    }

    /** Non-negative integer → Vietnamese words. */
    /** 1 ≤ x < 1000^(SCALES.Length) → words; `lead` = higher digits precede x. */
    private static List<string> BelowTop(double x, bool lead)
    {
        var groups = new List<double>();
        while (x > 0)
        {
            groups.Add(x % 1000);
            x = Math.Floor(x / 1000);
        }
        var parts = new List<string>();
        for (var g = groups.Count - 1; g >= 0; g--)
        {
            if (groups[g] == 0) continue;
            parts.AddRange(Below1000(groups[g], lead || g < groups.Count - 1));
            if (g > 0) parts.Add(SCALES[g]);
        }
        return parts;
    }

    /** Above the top scale word (tỷ, 10⁹) the count of tỷ is read as a number, then tỷ: 10¹² is *một nghìn tỷ*
     *  (#1589). See `wordsOf` in src/languages/vietnamese/numbers.ts. */
    private static List<string> WordsOf(double x, bool lead)
    {
        var top = SCALES.Length - 1;
        var big = Math.Pow(1000, top);
        if (x < big) return BelowTop(x, lead);
        var hi = Math.Floor(x / big);
        var lo = x % big;
        var parts = WordsOf(hi, lead);
        parts.Add(SCALES[top]);
        if (lo > 0) parts.AddRange(BelowTop(lo, true));
        return parts;
    }

    public static string NumberToWords(double n)
    {
        if (!double.IsFinite(n) || n < 0) return "";
        if (n == 0) return ONES[0];
        return string.Join(" ", WordsOf(Math.Floor(n), false));
    }
}

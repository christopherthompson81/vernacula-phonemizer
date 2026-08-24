/**
 * Korean number → words. Korean has TWO systems: Sino-Korean (일 이 삼 …, used for dates/money/counting above
 * ~100) and native (하나 둘 셋 …, for small counts). This uses the Sino-Korean system (the default for digits),
 * scaling by 만 (10^4) / 억 (10^8) like other CJK. Digits are read as Hangul then phonemized.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Korean;

public static class KoreanNumbers
{
    // Number words are authored DATA — consolidated in korean.jsonc; the myriad-group compositor below is the algorithm.
    private static KoreanNumbersDef N => Manifest.MANIFEST.Numbers;
    private static string[] ONES => N.Ones;
    private static string[] UNITS => N.MyriadUnits;

    private static string Below10000(double n)
    {
        var s = "";
        double th = Math.Floor(n / 1000), h = Math.Floor(n % 1000 / 100), t = Math.Floor(n % 100 / 10), u = n % 10;
        if (th != 0) s += (th > 1 ? ONES[(int)th] : "") + N.Thousand;
        if (h != 0) s += (h > 1 ? ONES[(int)h] : "") + N.Hundred;
        if (t != 0) s += (t > 1 ? ONES[(int)t] : "") + N.Ten;
        if (u != 0) s += ONES[(int)u];
        return s;
    }

    /**
     * The digit-at-a-time reading — the fallback for a digit run `numberToWords` must refuse.
     *
     * ⚠ `numberToWords` RETURNS `""` FOR AN UNSAFE INTEGER AND THAT CONTRACT IS DELIBERATELY UNTOUCHED: three
     * callers in normalize.ts test it (`numberToWords(…) || t`, `w === "" ? m : w`) to mean "out of range, leave
     * the digits for the number path". The bug was that the number path then dropped them too. So the fallback
     * is a SEPARATE function, used at that path's end, and the emptiness contract still holds for normalize.ts.
     *
     * Sino-Korean digit names are what rule 6 already spells a decimal tail with (7.75 → 칠점칠오), so this
     * needs no word the engine has not measured.
     */
    public static string SpellDigits(string digits) =>
        string.Concat(Js.CodePoints(digits).Select(c =>
        {
            var i = (int)Js.Number(c);
            return i >= 0 && i < ONES.Length ? ONES[i] : "";
        }));

    /** Non-negative integer → Sino-Korean Hangul. `""` when out of range — see `spellDigits`, and its callers. */
    public static string NumberToWords(double n)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0) return "";
        if (n == 0) return ONES[0];
        var groups = new List<double>();
        var x = n;
        while (x > 0)
        {
            groups.Add(x % 10000);
            x = Math.Floor(x / 10000);
        }
        var outp = "";
        for (var g = groups.Count - 1; g >= 0; g--)
        {
            if (groups[g] == 0) continue;
            // ⚠ `UNITS[g] ?? ""` in the TS — an out-of-range myriad index yields undefined and the `??` makes
            // it empty, so a number past the authored ladder simply loses its magnitude word rather than
            // fabricating one. C# would throw on the index; the bound is explicit and gives the same "".
            outp += Below10000(groups[g]) + (g < UNITS.Length ? UNITS[g] : "");
        }
        return outp;
    }
}

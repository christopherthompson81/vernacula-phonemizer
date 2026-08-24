/**
 * Korean number → words: the Sino-Korean system (the default for digits), scaling by 만 (10⁴) / 억 (10⁸).
 * Ported from src/languages/korean/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Korean;

public static class KoreanNumbers
{
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
     * The digit-at-a-time reading — the fallback for a digit run `NumberToWords` must refuse. Kept a SEPARATE
     * function because callers test `NumberToWords(…) == ""` to mean "out of range, leave the digits".
     */
    public static string SpellDigits(string digits) =>
        string.Concat(Js.CodePoints(digits).Select(c =>
        {
            var i = (int)Js.Number(c);
            return i >= 0 && i < ONES.Length ? ONES[i] : "";
        }));

    /**
     * Non-negative integer → Sino-Korean Hangul. Returns "" past the JS safe-integer limit (2^53-1), where a
     * double has already lost the low digits — the callers read that "" as "spell the digits instead".
     */
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
            // The TS writes `UNITS[g] ?? ""`: an out-of-range myriad index yields undefined there, so the
            // number loses its magnitude word rather than fabricating one. C# would throw on that index, so
            // the bound is explicit here and gives the same "".
            outp += Below10000(groups[g]) + (g < UNITS.Length ? UNITS[g] : "");
        }
        return outp;
    }
}

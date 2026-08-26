/**
 * Malagasy cardinal number → words. Composed UNITS-FIRST, joined by "amby": 21 → iraika amby roapolo.
 * Ported from src/languages/malagasy/numbers.ts — see that file for the scope and its known limits.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Malagasy;

public static class Numbers
{
    private static MalagasyNumbers N => Manifest.MANIFEST.Numbers;
    private static string[] ONES => N.Ones;
    private static string[] TENS => N.Tens;
    private static string[] HUNDREDS => N.Hundreds;

    /** ones word, with the compound allomorph iraika for 1 (iray only stands alone). */
    private static string Ones1(double o, bool compound) => compound && o == 1 ? "iraika" : ONES[(int)o];

    /** 1 ≤ n < 100. */
    private static string Below100(double n, bool compound = false)
    {
        if (n < 10) return Ones1(n, compound);
        double t = Math.Floor(n / 10), o = n % 10;
        if (o == 0) return TENS[(int)t];
        return $"{Ones1(o, true)} {N.Connector} {TENS[(int)t]}";
    }

    /** 1 ≤ n < 1000. */
    private static string Below1000(double n, bool compound = false)
    {
        if (n < 100) return Below100(n, compound);
        double h = Math.Floor(n / 100), r = n % 100;
        return r != 0 ? $"{Below100(r, true)} {N.Connector} {HUNDREDS[(int)h]}" : HUNDREDS[(int)h];
    }

    /** `ONES[Number(d)] || N.zero` — a non-digit character gives NaN, and ONES[0] is the empty string. */
    private static string DigitWord(char d)
    {
        var i = Js.Number(d.ToString());
        if (!(double.IsInteger(i) && i >= 0 && i < ONES.Length)) return N.Zero;
        var w = ONES[(int)i];
        return w.Length > 0 ? w : N.Zero;
    }

    /** Non-negative integer (< 10⁹) → Malagasy words; larger / non-finite → digit-by-digit. `compound` is
     *  threaded through the recursion so the tapitrisa remainder takes the same allomorph the arivo one does. */
    public static string NumberToWords(double n, bool compound = false)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e9)
            return string.Join(" ", Js.NumberToString(Math.Abs(n)).Select(DigitWord));
        if (n == 0) return N.Zero;
        if (n < 1000) return Below1000(n, compound);
        if (n < 1e6)
        {
            double th = Math.Floor(n / 1000), r0 = n % 1000;
            var thousand = th == 1 ? N.Thousand : $"{Below1000(th)} {N.Thousand}";
            return r0 != 0 ? $"{Below1000(r0, true)} {N.Connector} {thousand}" : thousand;
        }
        double mil = Math.Floor(n / 1e6), r = n % 1e6;
        var million = $"{Below1000(mil)} {N.Million}";
        return r != 0 ? $"{NumberToWords(r, true)} {N.Connector} {million}" : million;
    }
}

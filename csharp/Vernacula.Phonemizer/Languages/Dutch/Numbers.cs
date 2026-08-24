/**
 * Dutch number → words (cardinals).
 * Ported from src/languages/dutch/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Dutch;

public static class Numbers
{
    private static DutchNumbersDef N => Manifest.MANIFEST.Numbers;
    private static string[] ONES => N.Ones;
    private static string[] TENS => N.Tens;

    private static readonly JsRe VOWEL_FINAL = JsRegex.Compile("[aeiou]$");

    /** The -en- connector, with a trema on ⟨e⟩ after a vowel-final unit (twee→tweeën, drie→drieën). */
    private static string Connect(string unit) => VOWEL_FINAL.IsMatch(unit) ? "ën" : N.Connector;

    /** 1 ≤ n < 100 (compounded: eenentwintig, tweeëntwintig). */
    private static string Below100(double n)
    {
        if (n < 20) return ONES[(int)n];
        double t = Math.Floor(n / 10), u = n % 10;
        if (u == 0) return TENS[(int)t];
        return $"{ONES[(int)u]}{Connect(ONES[(int)u])}{TENS[(int)t]}";
    }

    /** 1 ≤ n < 1000 (honderd, tweehonderddrieëntwintig). Dutch 100 = honderd (no leading een). */
    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        double h = Math.Floor(n / 100), r = n % 100;
        var hundred = $"{(h == 1 ? "" : ONES[(int)h])}{N.Hundred}";
        return r != 0 ? $"{hundred}{Below100(r)}" : hundred;
    }

    /** Non-negative integer (< 10¹²) → Dutch words; larger / non-finite → digit-by-digit. */
    public static string NumberToWords(double n)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e12)
            return string.Join(" ", Js.CodePoints(Js.NumberToString(Math.Abs(n)))
                .Select(d =>
                {
                    var i = Js.Number(d);
                    return double.IsInteger(i) && i >= 0 && i < ONES.Length ? ONES[(int)i] : d;
                }));
        if (n == 0) return ONES[0]; // nul
        if (n < 1000) return Below1000(n);
        var parts = new List<string>();
        double mrd = Math.Floor(n / 1e9),
            mil = Math.Floor(n % 1e9 / 1e6),
            th = Math.Floor(n % 1e6 / 1000),
            r = n % 1000;
        if (mrd != 0) parts.Add(mrd == 1 ? N.Milliard.Sg : $"{Below1000(mrd)} {N.Milliard.Pl}");
        if (mil != 0) parts.Add(mil == 1 ? N.Million.Sg : $"{Below1000(mil)} {N.Million.Pl}");
        if (th != 0) parts.Add($"{(th == 1 ? "" : Below1000(th))}{N.Thousand}");
        if (r != 0) parts.Add(Below1000(r));
        return string.Join(" ", parts);
    }
}

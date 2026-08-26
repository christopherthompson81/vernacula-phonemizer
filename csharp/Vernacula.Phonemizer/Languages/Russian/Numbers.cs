/**
 * Russian number → words (cardinals, nominative).
 * Ported from src/languages/russian/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Russian;

public static class Numbers
{
    private static RussianNumbersDef N => Manifest.MANIFEST.Numbers;
    private static IReadOnlyList<string> ONES => N.Ones;
    private static IReadOnlyList<string> TENS => N.Tens;
    private static IReadOnlyList<string> HUNDREDS => N.Hundreds;

    /** Plural form selector for Russian quantities (1 → one, 2–4 → few, else → many). */
    private static string Plural(double n, string one, string few, string many)
    {
        double mod10 = n % 10, mod100 = n % 100;
        if (mod10 == 1 && mod100 != 11) return one;
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
        return many;
    }

    /** 1 ≤ n < 1000 */
    private static string Below1000(double n)
    {
        var parts = new List<string>();
        int h = (int)Math.Floor(n / 100), t = (int)Math.Floor(n % 100 / 10), u = (int)(n % 10);
        if (h != 0) parts.Add(HUNDREDS[h]);
        if (t >= 2)
        {
            parts.Add(TENS[t]);
            if (u != 0) parts.Add(ONES[u]);
        }
        else if (t == 1) parts.Add(ONES[10 + u]);
        else if (u != 0) parts.Add(ONES[u]);
        return string.Join(" ", parts);
    }

    private static readonly JsRe ODIN_FINAL = JsRegex.Compile("один$");
    private static readonly JsRe DVA_FINAL = JsRegex.Compile("два$");

    /** Non-negative integer (< 10⁹) → Russian words; larger / non-finite → digit-by-digit. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e9)
            return string.Join(" ", (raw ?? Js.NumberToString(Math.Abs(n)))
                .Select(d => d >= '0' && d <= '9' && d - '0' < ONES.Count ? ONES[d - '0'] : d.ToString()));
        if (n < 20) return ONES[(int)n];
        if (n < 1000) return Below1000(n);
        var parts = new List<string>();
        double mil = Math.Floor(n / 1e6), th = Math.Floor(n % 1e6 / 1000), r = n % 1000;
        if (mil != 0)
        {
            parts.Add(Below1000(mil));
            parts.Add(Plural(mil, N.Million[0], N.Million[1], N.Million[2]));
        }
        if (th != 0)
        {
            var thWords = DVA_FINAL.Replace(
                ODIN_FINAL.Replace(Below1000(th), N.ThousandFeminine.One),
                N.ThousandFeminine.Two); // тысяча is feminine (JS \b fails on Cyrillic)
            parts.Add(thWords);
            parts.Add(Plural(th, N.Thousand[0], N.Thousand[1], N.Thousand[2]));
        }
        if (r != 0) parts.Add(Below1000(r));
        return string.Join(" ", parts);
    }
}

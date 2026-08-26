/**
 * Kalaallisut / West Greenlandic (kl) cardinal number → words — native Greenlandic 0–12, Danish loan
 * numerals (in Danish orthography) from 13 up.
 * Ported from src/languages/kalaallisut/numbers.ts — see that file for the corpus evidence.
 */

using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kalaallisut;

public static class Numbers
{
    /**
     * THE NUMERAL LEXICON, from the manifest. ⚠ NATIVE 0–12, DANISH FROM 13 — a necessity, not a shortcut:
     * the traditional system is a body-part tally (`arfinillit` 6 = "other hand"+1, `aqqanillit` 11 =
     * "going down" to the feet +1) with nowhere to put a thousand, so speakers borrow Danish above the
     * small counts. The words are data; the arithmetic below is not. See the TS module and the jsonc.
     */
    private static IReadOnlyList<string> NATIVE => KalaallisutPhonemizer.DEF.Numbers.Native;
    private static KalaallisutDanish DK => KalaallisutPhonemizer.DEF.Numbers.Danish;
    private static IReadOnlyList<string> DK_UNITS => DK.Units;
    private static IReadOnlyList<string> DK_10_19 => DK.Teens;
    private static IReadOnlyDictionary<string, string> DK_TENS => DK.Tens;
    private static string DK_AND => DK.And;
    private static string DK_HUNDRED => DK.Hundred;
    private static string DK_THOUSAND => DK.Thousand;

    /** Danish 1 ≤ n < 100, solid (femogtyve). */
    private static string DkBelow100(double n)
    {
        if (n < 10) return DK_UNITS[(int)n];
        if (n < 20) return DK_10_19[(int)n - 10];
        double t = Math.Floor(n / 10) * 10, u = n % 10;
        var ten = DK_TENS[Js.NumberToString(t)];
        return u == 0 ? ten : $"{DK_UNITS[(int)u]}{DK_AND}{ten}"; // enogtyve, otteoghalvfems
    }

    /** Danish 1 ≤ n < 1000, solid (syvhundredetretten; bare `hundrede` for exactly 100). */
    private static string DkBelow1000(double n)
    {
        double h = Math.Floor(n / 100), r = n % 100;
        if (h == 0) return DkBelow100(n);
        var head = (h == 1 ? "" : DK_UNITS[(int)h]) + DK_HUNDRED;
        return r == 0 ? head : head + DkBelow100(r);
    }

    /** Danish 1 ≤ n < 10⁶, solid (tolvtusindtrehundredefemogfyrre). */
    private static string DkBelow1e6(double n)
    {
        double th = Math.Floor(n / 1000), r = n % 1000;
        if (th == 0) return DkBelow1000(n);
        var head = (th == 1 ? "" : DkBelow1000(th)) + DK_THOUSAND;
        return r == 0 ? head : head + DkBelow1000(r);
    }

    /** Read a digit string one digit at a time (the ≥10¹² / unsafe-integer fallback; Danish units). */
    public static string ReadDigits(string digits) =>
        string.Join(" ", Js.CodePoints(digits).Select(d =>
            d == "0" ? NATIVE[0]
            : d.Length == 1 && d[0] >= '1' && d[0] <= '9' ? DK_UNITS[d[0] - '0']
            : d));

    /** Non-negative integer → Kalaallisut cardinal words. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e12) return ReadDigits(raw ?? Js.NumberToString(n));
        if (n <= 12) return NATIVE[(int)n]; // the native series — only when the WHOLE figure is ≤12
        if (n < 1e6) return DkBelow1e6(n);
        if (n < 1e9)
        {
            double m = Math.Floor(n / 1e6), r1 = n % 1e6;
            var head1 = m == 1 ? DK.Million.Singular : $"{DkBelow1000(m)} {DK.Million.Plural}";
            return r1 == 0 ? head1 : $"{head1} {DkBelow1e6(r1)}";
        }
        double b = Math.Floor(n / 1e9), r = n % 1e9;
        var head = b == 1 ? DK.Milliard.Singular : $"{DkBelow1000(b)} {DK.Milliard.Plural}";
        return r == 0 ? head : $"{head} {NumberToWords(r)}";
    }
}

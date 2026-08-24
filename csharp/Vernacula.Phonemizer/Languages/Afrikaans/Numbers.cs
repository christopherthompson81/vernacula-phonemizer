/**
 * Afrikaans (af) cardinal-number → words compositor.
 * Ported from src/languages/afrikaans/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Afrikaans;

public static class Numbers
{
    private static AfrikaansNumbersDef N => Manifest.MANIFEST.Numbers;

    /** 1–99 → Afrikaans words. Compound X1–X9 is unit-en-ten (drie-en-twintig → "drie en twintig"). */
    private static string Below100(double n)
    {
        if (n < 10) return N.Units[(int)n];
        if (n < 20) return N.Teens[(int)n - 10];
        double t = Math.Floor(n / 10), u = n % 10;
        return u == 0 ? N.Tens[(int)t] : $"{N.Units[(int)u]} {N.En} {N.Tens[(int)t]}";
    }

    /** 1–999 → words: [unit] honderd [en remainder]; a lone hundred is just "honderd". */
    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        double h = Math.Floor(n / 100), rest = n % 100;
        var head = (h == 1 ? "" : $"{N.Units[(int)h]} ") + N.Hundred;
        return rest != 0 ? $"{head} {N.En} {Below100(rest)}" : head;
    }

    /** A magnitude group. */
    private static string Magnitude(double mult, string word, bool bareAtOne) =>
        mult == 1 && bareAtOne ? word : $"{Below1000(mult)} {word}";

    /** 0 … 10⁹-1 → Afrikaans words; beyond (or unsafe) → digit-by-digit units. */
    public static string NumberToWords(double n)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e9)
            return string.Join(" ", Js.NumberToString(n).Select(d =>
                d >= '0' && d <= '9' ? N.Units[d - '0'] : d.ToString()));
        if (n < 1000) return Below1000(n);
        var parts = new List<string>();
        if (n >= 1e6) { parts.Add(Magnitude(Math.Floor(n / 1e6), N.Million, false)); n %= 1e6; }
        if (n >= 1000) { parts.Add(Magnitude(Math.Floor(n / 1000), N.Thousand, true)); n %= 1000; }
        if (n > 0) parts.Add(Below1000(n));
        return string.Join(" ", parts);
    }
}

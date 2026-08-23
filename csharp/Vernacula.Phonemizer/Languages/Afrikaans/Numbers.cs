/**
 * Afrikaans (af) cardinal-number → words compositor. Afrikaans uses the Dutch-style UNIT-en-TEN order
 * (21 = een-en-twintig) and joins the sub-100 remainder to hundreds/thousands with "en" (honderd-en-vyf). The words
 * are authored in afrikaans.jsonc; numberToWords returns them space-separated and afrikaans.ts phonemizes each
 * through the g2p, so numbers stay in our canonical convention. Handles 0 … 10⁹-1; digit-by-digit fallback beyond.
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

    /**
     * A magnitude group. ⚠ A LONE THOUSAND IS BARE — *duisend*, not "een duisend" — but MILLION AND UP KEEP THE
     * NUMERAL: 1 000 000 is *een miljoen*, and reading it as a bare *miljoen* drops the count entirely. Same split
     * `core/numbers.ts` documents on `bareMagnitude`.
     */
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

/**
 * Arabic number → canonical IPA (Modern Standard Arabic, counting/masculine forms).
 * Ported from src/languages/arabic/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Arabic;

public static class Numbers
{
    private static ArabicNumberData MSA => Manifest.MANIFEST.Numbers;

    /** 0 ≤ n < 100 */
    private static string Below100(double n, ArabicNumberData d)
    {
        if (n < 10) return d.Ones[(int)n];
        if (n < 20) return d.Teens[(int)n - 10];
        int t = (int)Math.Floor(n / 10), u = (int)(n % 10);
        return u == 0 ? d.Tens[t] : $"{d.Ones[u]} {d.Connector} {d.Tens[t]}"; // ones precede tens: 21 = waːħid wa ʕiʃruːn
    }

    /** 1 ≤ n < 1000 */
    private static string Below1000(double n, ArabicNumberData d)
    {
        int h = (int)Math.Floor(n / 100);
        double r = n % 100;
        var head = "";
        if (h >= 1 && d.HundredsFused is not null) head = d.HundredsFused[h]; // dialect fused forms (mijːa, miteːn, tultumijːa)
        else if (h == 1) head = d.Magnitudes.Hundred;
        else if (h == 2) head = d.Magnitudes.HundredDual;
        else if (h >= 3) head = $"{d.HundredsConstruct![h]}{d.Magnitudes.Hundred}"; // θalaːθumiʔa
        if (h == 0) return Below100(n, d);
        return r != 0 ? $"{head} {d.Connector} {Below100(r, d)}" : head;
    }

    /** 1 ≤ n < 10⁶ */
    private static string Below1e6(double n, ArabicNumberData d)
    {
        if (n < 1000) return Below1000(n, d);
        double th = Math.Floor(n / 1000), r = n % 1000;
        string head;
        if (th == 1) head = d.Magnitudes.Thousand;
        else if (th == 2) head = d.Magnitudes.ThousandDual;
        else if (th <= 10) head = $"{Below100(th, d)} {d.Magnitudes.ThousandsPlural}"; // 3–10 thousand: plural ʔaːlaːf
        else head = $"{Below1000(th, d)} {d.Magnitudes.Thousand}";
        return r != 0 ? $"{head} {d.Connector} {Below1000(r, d)}" : head;
    }

    /** Non-negative integer (< 10⁹) → Arabic IPA words. Larger / invalid → digit-by-digit (digits only). */
    public static string NumberToIpa(double n, ArabicNumberData? data = null, string? raw = null)
    {
        var d = data ?? MSA;
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e9)
        {
            return string.Join(" ", (raw ?? Js.NumberToString(Math.Abs(n)))
                .Where(x => x >= '0' && x <= '9')
                .Select(x => d.Ones[x - '0'])
                .Where(w => !string.IsNullOrEmpty(w)));
        }
        if (n == 0) return d.Ones[0]; // sˤifr
        if (n < 1e6) return Below1e6(n, d);
        double m = Math.Floor(n / 1e6), r = n % 1e6;
        string head;
        if (m == 1) head = d.Magnitudes.Million;
        else if (m == 2) head = d.Magnitudes.MillionDual; // dual
        else if (m <= 10) head = $"{Below100(m, d)} {d.Magnitudes.MillionsPlural}"; // 3–10 million: plural malaːjiːn
        else head = $"{Below1000(m, d)} {d.Magnitudes.Million}";
        return r != 0 ? $"{head} {d.Connector} {Below1e6(r, d)}" : head;
    }
}

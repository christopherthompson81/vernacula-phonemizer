/**
 * Fula (Fulfulde/Pulaar) cardinal number → words — QUINARY below ten, DECIMAL above it, with the vigesimal
 * relic at 20 and the magnitude nouns taking their ƊE plural when multiplied.
 * Ported from src/languages/fula/numbers.ts — see that file for every source and the lect decision.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Fula;

public static class FulaNumbers
{
    /** 0–9. 6–9 are the quinary jee- (5+n) compounds. */
    private static readonly string[] ONES =
        { "meere", "goo", "ɗiɗi", "tati", "nayi", "joyi", "jeegom", "jeeɗiɗi", "jeetati", "jeenayi" };
    private const string TEN = "sappo";
    private const string TWENTY = "noogaas";
    private const string TENS_PL = "cappanɗe";
    private const string E = "e";
    private const string HUNDRED = "teemedere";
    private const string HUNDRED_PL = "teemedde";
    private const string THOUSAND = "ujundere";
    private const string THOUSAND_PL = "ujunaaje";
    private const string MILLION = "million";
    private const string MILLION_PL = "milionji";
    private const string BILLION = "milyar";
    private const string BILLION_PL = "milyarji";

    /** 0–99: sappo / noogaas / cappanɗe + multiplier, units added with e. */
    private static string Below100(double n)
    {
        if (n < 10) return ONES[(int)n];
        double t = Math.Floor(n / 10), u = n % 10;
        var head = t == 1 ? TEN : t == 2 ? TWENTY : $"{TENS_PL} {ONES[(int)t]}";
        return u == 0 ? head : $"{head} {E} {ONES[(int)u]}";
    }

    /** 1–999: teemedere (100) / teemedde + multiplier; remainder added with e. */
    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        double h = Math.Floor(n / 100), r = n % 100;
        var head = h == 1 ? HUNDRED : $"{HUNDRED_PL} {ONES[(int)h]}";
        return r == 0 ? head : $"{head} {E} {Below100(r)}";
    }

    /** A magnitude slot: the singular noun bare for ×1, else the plural + the multiplier. */
    private static string Magnitude(string sg, string pl, double count) =>
        count == 1 ? sg : $"{pl} {Below1000(count)}";

    /** Non-negative integer → Fula words; out of range → digit-by-digit. */
    public static string NumberToWords(double n)
    {
        // JS `Number.isSafeInteger`: a finite integer within ±(2^53 − 1).
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e12)
        {
            return string.Join(" ", Js.CodePoints(Js.NumberToString(Math.Abs(n)))
                .Where(c => string.CompareOrdinal(c, "0") >= 0 && string.CompareOrdinal(c, "9") <= 0)
                .Select(d => ONES[(int)Js.Number(d)]));
        }
        if (n < 1000) return Below1000(n);
        if (n < 1e6)
        {
            double th = Math.Floor(n / 1000), r = n % 1000;
            var head = Magnitude(THOUSAND, THOUSAND_PL, th);
            return r == 0 ? head : $"{head} {E} {Below1000(r)}";
        }
        if (n < 1e9)
        {
            double m = Math.Floor(n / 1e6), r = n % 1e6;
            var head = Magnitude(MILLION, MILLION_PL, m);
            return r == 0 ? head : $"{head} {E} {NumberToWords(r)}";
        }
        double b = Math.Floor(n / 1e9), rb = n % 1e9;
        var bhead = Magnitude(BILLION, BILLION_PL, b);
        return rb == 0 ? bhead : $"{bhead} {E} {NumberToWords(rb)}";
    }

    /**
     * Adlam digits 𞥐–𞥙 (U+1E950–1E959) → ASCII, so the number branch serves both registered scripts. The
     * shared fold, not a fourth copy of the arithmetic — see the TS.
     */
    public static string FoldAdlamDigits(string s) => Unicode.FoldNativeDigits(s);
}

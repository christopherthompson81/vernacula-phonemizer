/**
 * Wolof cardinal number → words. QUINARY below ten, DECIMAL above it: 6–9 are 5+n compounds on `juróom`, the
 * round tens are multiplicative on `fukk` with the (possibly quinary) multiplier FIRST, and magnitude slots
 * join with the coordinator `ak`.
 * Ported from src/languages/wolof/numbers.ts — see that file for the four cited sources and for why only
 * million/billion are borrowed forms.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Wolof;

public static class Numbers
{
    // 0–9. 6–9 are the quinary 5+n compounds (multi-word by design — the composer joins on spaces).
    private static readonly string[] ONES =
    [
        "tus", "benn", "ñaar", "ñett", "ñeent", "juróom",
        "juróom benn", "juróom ñaar", "juróom ñett", "juróom ñeent",
    ];
    private const string TEN = "fukk";
    private const string AK = "ak"; // the additive coordinator between magnitude slots
    private const string HUNDRED = "téeméer";
    private const string THOUSAND = "junni";
    private const string MILLION = "milyoŋ";
    private const string BILLION = "milyaar";

    /** `Number.isSafeInteger` — the local idiom the fleet uses; there is no BCL equivalent. */
    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    /** 1–99: `fukk` takes the quinary multiplier FIRST; units are added with `ak`. */
    private static string Below100(double n)
    {
        if (n < 10) return ONES[(int)n];
        var t = (int)Math.Floor(n / 10);
        var u = (int)(n % 10);
        // 10 is the bare fukk; 20–90 are MULT + fukk (the multiplier itself may be quinary).
        var tens = t == 1 ? TEN : $"{ONES[t]} {TEN}";
        return u == 0 ? tens : $"{tens} {AK} {ONES[u]}";
    }

    /** 1–999: `téeméer` takes a preceding multiplier (bare for 100); the remainder is added with `ak`. */
    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        var h = Math.Floor(n / 100);
        var r = n % 100;
        var head = h == 1 ? HUNDRED : $"{Below100(h)} {HUNDRED}";
        return r == 0 ? head : $"{head} {AK} {Below100(r)}";
    }

    /** Non-negative integer → Wolof words; beyond the attested range → digit-by-digit (no invented
     *  magnitudes). */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!IsSafeInteger(n) || n < 0 || n >= 1e12)
        {
            return string.Join(" ", Js.CodePoints(raw ?? Js.NumberToString(Math.Abs(n)))
                .Where(c => string.CompareOrdinal(c, "0") >= 0 && string.CompareOrdinal(c, "9") <= 0)
                .Select(d => (Core.Numbers.DigitWord(ONES, d) ?? d)));
        }
        if (n < 1000) return Below1000(n);
        if (n < 1e6)
        {
            var th = Math.Floor(n / 1000);
            var r = n % 1000;
            var head = th == 1 ? THOUSAND : $"{Below1000(th)} {THOUSAND}";
            return r == 0 ? head : $"{head} {AK} {Below1000(r)}";
        }
        if (n < 1e9)
        {
            var m = Math.Floor(n / 1e6);
            var r = n % 1e6;
            var head = m == 1 ? MILLION : $"{Below1000(m)} {MILLION}";
            return r == 0 ? head : $"{head} {AK} {NumberToWords(r)}";
        }
        var b = Math.Floor(n / 1e9);
        var rb = n % 1e9;
        var bhead = b == 1 ? BILLION : $"{Below1000(b)} {BILLION}";
        return rb == 0 ? bhead : $"{bhead} {AK} {NumberToWords(rb)}";
    }
}

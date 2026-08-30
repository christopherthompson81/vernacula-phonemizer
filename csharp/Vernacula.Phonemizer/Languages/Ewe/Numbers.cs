/**
 * Ewe (Eʋegbe) cardinal number → words. Ported from src/languages/ewe/numbers.ts, whose header carries the
 * sources (Omniglot "Numbers in Ewe"; desmotsetdeslangues.eklablog.com/ewe) and the variants NOT taken.
 *
 * DECIMAL, but *morphologically* opaque enough to need a bespoke composer rather than the shared western
 * composer: the teens and the round tens are PREFIXED derivations of the unit stem, not "ten + unit" word
 * pairs — wui- for 11–19, bla- for 20–90 (a multiplicative TEN prefix, so blaeve 20 is literally 'ten×two'
 * and blaene 40 is 'ten×four', which is why a base-20 composer would be wrong despite the "vigesimal"
 * label Ewe often carries). 21–99 link with `vɔ` 'plus'; the magnitude nouns alafa / akpe / miliɔn take a
 * FOLLOWING multiplier and the slots are joined with `kple` 'and'.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Ewe;

public static class Numbers
{
    /** 0–9. 0 is the negated existential `naneke o` 'nothing' — ⚠ TWO WORDS, which the text path splits. */
    private static readonly string[] ONES =
        ["naneke o", "ɖeka", "eve", "etɔ̃", "ene", "atɔ̃", "ade", "adre", "enyi", "asieke"];
    private const string TEN = "ewo";

    /** The bound stem the wui-/bla- prefixes attach to. The sources show the unit spellings as listed —
     *  bla+eve→blaeve but bla+atɔ̃→blaatɔ̃ — so the stems ARE the unit spellings, with ɖeke for 1. */
    private static readonly string[] STEM =
        ["", "ɖeke", "eve", "etɔ̃", "ene", "atɔ̃", "ade", "adre", "enyi", "asieke"];

    private const string PLUS = "vɔ";      // tens→units linker
    private const string AND = "kple";     // magnitude-slot coordinator
    private const string HUNDRED = "alafa";
    private const string THOUSAND = "akpe";
    private const string MILLION = "miliɔn";

    /** 0–99: wui- teens, bla- tens, TENS vɔ UNIT compounds. */
    private static string Below100(int n)
    {
        if (n < 10) return ONES[n];
        if (n == 10) return TEN;
        if (n < 20) return $"wui{STEM[n - 10]}";
        int t = n / 10, u = n % 10;
        var tens = $"bla{STEM[t]}";
        return u == 0 ? tens : $"{tens} {PLUS} {ONES[u]}";
    }

    /** 1–999: alafa + multiplier, remainder joined with kple. */
    private static string Below1000(int n)
    {
        if (n < 100) return Below100(n);
        int h = n / 100, r = n % 100;
        var head = $"{HUNDRED} {ONES[h]}"; // alafa ɖeka 100, alafa eve 200 — the multiplier FOLLOWS
        return r == 0 ? head : $"{head} {AND} {Below100(r)}";
    }

    /** JS `Number.isSafeInteger(n)`: an integral double inside ±(2^53 − 1). */
    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    /**
     * Non-negative integer → Ewe words; beyond the attested magnitudes (≥ 10⁹) → digit-by-digit.
     *
     * ⚠ THE DIGIT ARM READS `raw` WHEN IT HAS ONE — the token as the text wrote it, not a re-stringified
     * double, because above 2^53 the double is precisely what cannot be trusted. Non-digits are filtered
     * out rather than read, which is how a `-` or a `.` that reached here disappears instead of throwing.
     */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!IsSafeInteger(n) || n < 0 || n >= 1e9)
        {
            // No attested Ewe numeral above miliɔn — read the digits rather than invent a "billion".
            var src = raw ?? Js.NumberToString(Math.Abs(n));
            return string.Join(" ", Js.CodePoints(src).Where(c => string.CompareOrdinal(c, "0") >= 0
                                                              && string.CompareOrdinal(c, "9") <= 0)
                                                     .Select(d => ONES[(int)Js.Number(d)]));
        }
        if (n < 1000) return Below1000((int)n);
        if (n < 1e6)
        {
            int th = (int)Math.Floor(n / 1000), r = (int)(n % 1000);
            var head = $"{THOUSAND} {Below1000(th)}"; // akpe ɖeka 1000, akpe ewo 10000
            return r == 0 ? head : $"{head} {AND} {Below1000(r)}";
        }
        {
            var m = Math.Floor(n / 1e6);
            var r = n % 1e6;
            var head = $"{MILLION} {Below1000((int)m)}"; // miliɔn ɖeka 1000000
            return r == 0 ? head : $"{head} {AND} {NumberToWords(r)}";
        }
    }
}

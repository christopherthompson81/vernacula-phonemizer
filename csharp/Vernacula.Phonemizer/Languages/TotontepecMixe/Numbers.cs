/**
 * Totontepec Mixe (mto / ayöök) cardinal number → words. VIGESIMAL (base 20).
 *
 * ⚠ THE GRAMMAR DOES NOT COVER NUMERALS. The g2p is authored from Crawford (SIL, 1963), but that is a
 * PHONOLOGY with no numeral list, so this data is cited to "Of Languages and Numbers" (variety-specific to
 * mto), whose bibliography is Schoenhals & Schoenhals, *Vocabulario Mixe de Totontepec* (ILV, 1965).
 * ATTESTED RANGE 1…999 — the source states outright that no more can be counted accurately, so ≥ 1000
 * falls back to DIGIT-BY-DIGIT and nothing above 999 is invented.
 * Ported from src/languages/totontepecmixe/numbers.ts — see that file for the three disclosed gaps (the
 * reconstructed ⟨8⟩, the unattested hundred→remainder join, and the zero stopgap).
 */
namespace Vernacula.Phonemizer.Languages.TotontepecMixe;

public static class Numbers
{
    private const string ZERO = "sero"; // loan stopgap — NOT attested (see the TS header)
    /** 1..9. Index 8 is the reconstruction discussed in the TS header. */
    private static readonly string[] UNITS =
        ["", "to'c", "me̱jtsc", "toojc", "mactaaxc", "mugo̱o̱xc", "tojtu̱c", "vuxtojtu̱c", "todojtu̱c", "taxtojtu̱c"];
    private const string TEN = "majc";
    /** 10..19 as they appear bound after a score (index 0 = 10). */
    private static readonly string[] TENS_PART =
        [TEN, "macto'c", "macme̱jtsc", "mactoojc", "macmajcts", "macmó̱cx", "mactojt", "macvuxtojt", "mactodojt", "mactaxtojt"];
    /** The four TWENTIES, index 1..4 → 20, 40, 60, 80. */
    private static readonly string[] SCORES = ["", "ii'px", "vu̱jxtcupx", "toogupx", "majctupx"];
    private const string HUNDRED = "mó̱cupx";

    /** The ⟨u̱c⟩ element that joins 40/60/80 to a following ⟨majc⟩/⟨mac-⟩ element (50, 70, 90, 96) but never
     *  follows ii'px (30 ii'pxmajc, 35 ii'pxmacmó̱cx) and never precedes a bare unit (62 toogupxme̱jtsc). */
    private static string Link(int k) => k == 1 ? "" : "u̱c";

    /** 1 ≤ n < 100, written SOLID. */
    private static string Below100(double n)
    {
        if (n < 10) return UNITS[(int)n];
        if (n < 20) return TENS_PART[(int)n - 10];
        var k = (int)Math.Floor(n / 20);
        var r = (int)(n % 20);
        if (r == 0) return SCORES[k];
        if (r < 10) return SCORES[k] + UNITS[r];               // ii'pxto'c 21, toogupxme̱jtsc 62
        return SCORES[k] + Link(k) + TENS_PART[r - 10];        // ii'pxmacmó̱cx 35, majctupxu̱cmactojt 96
    }

    /** Non-negative integer → Totontepec Mixe words. ≥ 1000 (no attested thousand) → digit-by-digit. */
    public static string NumberToWords(double n, string? raw = null)
    {
        // JS `Number.isSafeInteger(n)`: an integral double inside ±2^53 − 1.
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991.0) || n < 0 || n >= 1000)
            return string.Join(" ", Core.Js.CodePoints(raw ?? Core.Js.NumberToString(Math.Abs(n)))
                .Where(c => string.CompareOrdinal(c, "0") >= 0 && string.CompareOrdinal(c, "9") <= 0)
                .Select(d => d == "0" ? ZERO : UNITS[(int)Core.Js.Number(d)]));
        if (n == 0) return ZERO;
        if (n < 100) return Below100(n);
        var h = (int)Math.Floor(n / 100);
        var r = n % 100;
        var head = h == 1 ? HUNDRED : $"{UNITS[h]} {HUNDRED}"; // bare mó̱cupx for 100
        return r == 0 ? head : $"{head} {Below100(r)}";        // the hundred→remainder space is not attested
    }
}

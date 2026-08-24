/**
 * Tamil cardinal number → words (space-separated), Indian grouping (ஆயிரம் 10³ / லட்சம் 10⁵ / கோடி 10⁷).
 *
 * The thing that makes Tamil different from the Indo-Aryan neighbours already done (hi/bn/ur) is that the
 * compounding is SANDHI, not concatenation: a numeral part changes shape depending on whether anything
 * follows it. நூறு "100" but நூற்றி "100 and…"; ஆயிரம் "1000" but ஆயிரத்து "1000 and…"; and 200/300/900
 * are fused stems (இருநூறு, முந்நூறு, தொள்ளாயிரம்), not "two hundred". So each level picks between a FREE
 * form and a COMBINING form, and 11–19 are suppletive. All of it is authored DATA in tamil.jsonc; this
 * file is only the compositor.
 *
 * evidence: before this, every one of the 660 numerals in the ta_in corpus went through the naive
 * concatenating path — 1995 read *ஒன்று ஆயிரம் ஒன்பது நூறு தொண்ணூறு ஐந்து instead of ஆயிரத்து
 * தொள்ளாயிரத்து தொண்ணூற்றி ஐந்து.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Tamil;

public static class TamilNumbersComposer
{
    // Number words are authored DATA — consolidated in tamil.jsonc; the Indian-grouping compositor is the algorithm.
    private static TamilNumbers N => Manifest.MANIFEST.Numbers;
    private static string[] ONES => N.Units;
    private static string[] TENS => N.Tens;
    private static string[] TEENS => N.Teens;
    private static string[] TENS_C => N.TensCombining;
    private static string[] HUND => N.Hundreds;
    private static string[] HUND_C => N.HundredsCombining;
    private static string[] THOU => N.Thousands;
    private static string[] THOU_C => N.ThousandsCombining;
    private static TamilNumbers.MagnitudesDef M => N.Magnitudes;

    /** 1–99. `10 + u` is suppletive (பன்னிரண்டு); 21–99 is the ten's OBLIQUE form plus the unit. */
    private static List<string> Below100(double n)
    {
        if (n <= 0) return new List<string>();
        if (n < 10) return new List<string> { ONES[(int)n] };
        if (n < 20) return n == 10 ? new List<string> { TENS[1] } : new List<string> { TEENS[(int)n - 11] };
        double t = Math.Floor(n / 10), u = n % 10;
        return u == 0
            ? new List<string> { TENS[(int)t] }
            : new List<string> { TENS_C[(int)t], ONES[(int)u] };
    }

    /** 1–999. The hundred is a fused stem, and takes its oblique form when a remainder follows. */
    private static List<string> Below1000(double n)
    {
        double h = Math.Floor(n / 100), r = n % 100;
        if (h == 0) return Below100(r);
        if (r == 0) return new List<string> { HUND[(int)h] };
        var outp = new List<string> { HUND_C[(int)h] };
        outp.AddRange(Below100(r));
        return outp;
    }

    /**
     * The thousands group. 1–10 thousand are single fused words (ஆயிரம் … பத்தாயிரம்); above that Tamil fuses
     * the count into the same word (23,000 = இருபத்து மூவாயிரம்), approximated here as the ten's oblique plus
     * the fused thousand (இருபத்தி மூவாயிரம்) — the same joint, one degree less contracted. For counts of 100+
     * the count is spelled out before a free ஆயிரம்/ஆயிரத்து.
     */
    private static List<string> Thousands(double count, bool hasRemainder)
    {
        var fused = hasRemainder ? THOU_C : THOU;
        var bare = hasRemainder ? M.ThousandCombining : M.Thousand;
        if (count <= 10) return new List<string> { fused[(int)count] };
        if (count < 20) return new List<string> { TEENS[(int)count - 11], bare };
        if (count < 100)
        {
            double t = Math.Floor(count / 10), u = count % 10;
            return u == 0
                ? new List<string> { TENS[(int)t], bare }
                : new List<string> { TENS_C[(int)t], fused[(int)u] };
        }
        var outp = Below1000(count);
        outp.Add(bare);
        return outp;
    }

    /** Non-negative integer → Tamil words. */
    public static string NumberToWords(double n)
    {
        if (!double.IsFinite(n) || n < 0) return "";
        if (n == 0) return ONES[0];
        var parts = new List<string>();
        var crore = Math.Floor(n / 10000000);
        n %= 10000000;
        var lakh = Math.Floor(n / 100000);
        n %= 100000;
        var thou = Math.Floor(n / 1000);
        n %= 1000;
        // A magnitude noun takes the attributive ஒரு, never the free cardinal ஒன்று: ஒரு லட்சம், ஒரு கோடி.
        List<string> WithOne(double c) => c == 1 ? new List<string> { M.One } : Below1000(c);
        if (crore > 0)
        {
            parts.AddRange(WithOne(crore));
            parts.Add(lakh + thou + n > 0 ? M.CroreCombining : M.Crore);
        }
        if (lakh > 0)
        {
            parts.AddRange(WithOne(lakh));
            parts.Add(thou + n > 0 ? M.LakhCombining : M.Lakh);
        }
        if (thou > 0) parts.AddRange(Thousands(thou, n > 0));
        parts.AddRange(Below1000(n));
        return string.Join(" ", parts);
    }

    /**
     * The ORDINAL/oblique stem of a cardinal word, used by normalize.ts to build N-ஆம் and N-ஆவது. Tamil
     * forms these by attaching the suffix to the LAST word of the cardinal with a regular euphonic change —
     * 15ஆம் is பதினைந்தாம், one word, not *பதினைந்து ஆம் (which reaches the g2p as a stray syllable [aːm]).
     *
     * Three cases cover every word the compositor above can emit finally:
     *   -ு  → drop it            ஒன்று → ஒன்ற-,  பத்து → பத்த-,  தொண்ணூறு → தொண்ணூற-,  நூறு → நூற-
     *   -ம் → drop the virama    ஆயிரம் → ஆயிரம-,  தொள்ளாயிரம் → தொள்ளாயிரம-,  லட்சம் → லட்சம-
     *   -ி  → insert the glide ய   கோடி → கோடிய-
     */
    public static string? OrdinalStem(string word)
    {
        if (word.EndsWith("ு", StringComparison.Ordinal)) return word[..^1]; // ◌ு
        if (word.EndsWith("ம்", StringComparison.Ordinal)) return word[..^1]; // ம் → ம
        if (word.EndsWith("ி", StringComparison.Ordinal)) return $"{word}ய"; // ◌ி + ய
        return null;
    }
}

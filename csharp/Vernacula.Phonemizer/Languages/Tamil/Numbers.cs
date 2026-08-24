/**
 * Tamil cardinal number → words (space-separated), Indian grouping (ஆயிரம் 10³ / லட்சம் 10⁵ / கோடி 10⁷).
 * Ported from src/languages/tamil/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Tamil;

public static class TamilNumbersComposer
{
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

    /** The thousands group. */
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

    /** The ORDINAL/oblique stem of a cardinal word, used by normalize.ts to build N-ஆம் and N-ஆவது. */
    public static string? OrdinalStem(string word)
    {
        if (word.EndsWith("ு", StringComparison.Ordinal)) return word[..^1]; // ◌ு
        if (word.EndsWith("ம்", StringComparison.Ordinal)) return word[..^1]; // ம் → ம
        if (word.EndsWith("ி", StringComparison.Ordinal)) return $"{word}ய"; // ◌ி + ய
        return null;
    }
}

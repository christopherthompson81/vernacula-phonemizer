/**
 * Arabic number → Chinese numeral characters (quantity reading). The result is spliced back into the Han
 * character stream and phonemized like any other characters, so it inherits segmentation, polyphone
 * disambiguation, and tone sandhi for free (e.g. 一百 → yì bǎi via the phrase dict). Covers integers up to
 * 10¹⁶ and simple decimals (整数 + 点 + digit-by-digit). 2 is read 二 throughout (二千 is understood; the
 * colloquial 两 alternation is a future refinement). Year/phone/ID digit-string readings are out of scope —
 * this is the default quantity reading.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Mandarin;

public static class Numbers
{
    // Number-reading tables are authored DATA — consolidated in cmn.jsonc; the compositor below is the algorithm.
    private static CmnNumbersDef N => Manifest.MANIFEST.Numbers;
    private static IReadOnlyList<string> DIG => N.Digits; // 0–9 (DIG[0] 零 doubles as the internal zero-gap filler)
    private static IReadOnlyList<string> POS => N.Positions; // position value within a 4-digit group
    private static IReadOnlyList<string> BIG => N.BigUnits; // 10⁴ⁿ group multipliers
    private static string TWO => N.Two; // colloquial 两

    /**
     * 0 ≤ n ≤ 9999 → characters, with a single internal 零 for zero gaps. `top` marks the highest group so 2
     * as a leading multiplier of 百 reads 两 (两百五十) but a non-leading 二百 stays 二 (两千二百). 2 before 千
     * is always 两; 2 in tens/units stays 二 (二十, 十二).
     */
    private static string Group4(int n, bool top)
    {
        var s = "";
        var zeroPending = false;
        var digits = new[] { n / 1000 % 10, n / 100 % 10, n / 10 % 10, n % 10 };
        for (var i = 0; i < 4; i++)
        {
            var d = digits[i];
            if (d == 0)
            {
                if (s != "") zeroPending = true;
                continue;
            }
            if (zeroPending)
            {
                s += DIG[0];
                zeroPending = false;
            }
            var dig = DIG[d];
            if (d == 2 && i == 0) dig = TWO; // 千 → always 两千
            else if (d == 2 && i == 1 && s == "" && top) dig = TWO; // 百 → 两百 only when leading
            s += dig + POS[i];
        }
        return s;
    }

    /** Non-negative integer → Chinese numeral characters (quantity reading; colloquial 两 for standalone 2). */
    public static string IntegerToChinese(double n)
    {
        if (n == 0) return DIG[0];
        var groups = new List<int>();
        var x = n;
        while (x > 0)
        {
            groups.Add((int)(x % 10000));
            x = Math.Floor(x / 10000);
        }
        var s = "";
        for (var i = groups.Count - 1; i >= 0; i--)
        {
            var g = groups[i];
            if (g == 0) continue;
            if (s != "" && g < 1000) s += DIG[0]; // a group < 1000 below a higher group needs a spoken 零
            var gs = g == 2 && i < BIG.Count && BIG[i].Length > 0 ? TWO : Group4(g, s == ""); // 2万/2亿 → 两万/两亿
            s += gs + BIG[i];
        }
        // 12 → 十二 (not 一十二); 十万, 十亿…
        return JsRegex.Compile($"^{DIG[1]}{POS[2]}").Replace(s, POS[2]);
    }

    /** Digit string → per-digit numeral characters (0 → 〇). Used for year / ID / oversized readings (2024 →
     *  二〇二四). These are read one digit at a time, so 一 among them is a spoken digit (citation), never the
     *  quantity word — the caller marks them sandhi-exempt. */
    public static string DigitsToChinese(string digits) =>
        string.Concat(Js.CodePoints(digits).Select(d =>
            d == "0" ? N.ZeroDigit : d.Length == 1 && d[0] >= '1' && d[0] <= '9' ? DIG[d[0] - '0'] : d));
}

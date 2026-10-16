/**
 * Kazakh (kk) cardinal number compositor — the manifest's finished IPA atoms glued within a magnitude group
 * (онбір, екіжүз) and spaced between groups (бір мың екіжүз отызтөрт).
 * Ported from src/languages/kazakh/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kazakh;

public static class KazakhNumbers
{
    private static KazakhNumbersDef N => Manifest.MANIFEST.Numbers;
    private static string[] UNIT => N.Units;
    private static string[] TENS => N.Tens;
    private static string HUNDRED => N.Hundred;
    private static string THOUSAND => N.Thousand;
    private static string MILLION => N.Million;

    /** 0–99 → concatenated IPA (tens and units glued). */
    private static string Sub100(double n)
    {
        if (n < 10) return UNIT[(int)n];
        double t = Math.Floor(n / 10), u = n % 10;
        return TENS[(int)t] + (u != 0 ? UNIT[(int)u] : "");
    }

    /** 0–999 → IPA; the hundred-multiplier is glued (екіжүз) but the sub-hundred remainder is spaced. */
    private static string Sub1000(double n)
    {
        double h = Math.Floor(n / 100), r = n % 100;
        if (h == 0) return Sub100(r);
        var hp = h == 1 ? HUNDRED : UNIT[(int)h] + HUNDRED; // 100 omits the leading 1
        return r != 0 ? $"{hp} {Sub100(r)}" : hp;
    }

    /** The scales from 10⁶ up, highest first. Each, like the million, omits a leading 1 (#1576). */
    private static (string Word, double Size)[] HIGH_SCALES => new[] { (N.Trillion, 1e12), (N.Milliard, 1e9), (MILLION, 1e6) };

    /** A non-negative integer → space-separated canonical IPA (magnitude groups spaced, sub-groups glued). */
    public static string NumberToIpa(double n)
    {
        if (n < 0 || !double.IsFinite(n)) return "";
        n = Math.Floor(n);
        if (n < 1000) return Sub1000(n);
        var groups = new List<string>();
        foreach (var (word, size) in HIGH_SCALES)
        {
            var count = Math.Floor(n / size);
            n %= size;
            if (count != 0) groups.Add(count == 1 ? word : $"{NumberToIpa(count)} {word}"); // omits the leading 1
        }
        var th = Math.Floor(n / 1000);
        n %= 1000;
        if (th != 0) groups.Add($"{(th == 1 ? UNIT[1] : Sub1000(th))} {THOUSAND}"); // 1000 keeps it: бір мің
        if (n != 0) groups.Add(Sub1000(n));
        return string.Join(" ", groups);
    }

    /** A written digit run → IPA; past 2⁵³ digit by digit, as the double has lost the low digits (#1576). */
    public static string DigitsToIpa(string digits)
    {
        var n = Js.Number(digits);
        if (digits.Length > 0 && digits.All(char.IsAsciiDigit) && !Js.IsSafeInteger(n))
            return string.Join(" ", digits.Select(c => UNIT[c - '0']));
        return NumberToIpa(n);
    }
}

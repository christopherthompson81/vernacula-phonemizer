/**
 * Slovak (sk) cardinal number compositor — returns composed Slovak TEXT that Slovak.cs runs back through the
 * g2p. Tens+units concatenate (dvadsaťjeden); hundreds and thousands are space-separated. Thousand/million
 * agree 1 / 2–4 / 5+; both magnitude nouns are MASCULINE INANIMATE, so the multiplier is *dva*, not *dve*.
 * Ported from src/languages/slovak/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Slovak;

public static class SlovakNumbers
{
    private static SlovakNumbersDef N => Manifest.MANIFEST.Numbers;
    private static string[] UNITS => N.Units;
    private static string[] TEENS => N.Teens;
    private static string[] TENS => N.Tens;
    private static string[] HUNDREDS => N.Hundreds;
    private static SlovakMagnitudes MAG => N.Magnitudes;

    /** 0–99 → Slovak text (tens and units concatenated: dvadsaťjeden). */
    private static string Sub100(double n)
    {
        if (n < 10) return UNITS[(int)n];
        if (n < 20) return TEENS[(int)n - 10];
        return TENS[(int)Math.Floor(n / 10)] + (n % 10 != 0 ? UNITS[(int)(n % 10)] : "");
    }

    /** 0–999 → Slovak text (hundreds space-separated from the sub-hundred remainder). */
    private static string Sub1000(double n)
    {
        double h = Math.Floor(n / 100), r = n % 100;
        if (h == 0) return Sub100(r);
        return HUNDREDS[(int)h] + (r != 0 ? $" {Sub100(r)}" : "");
    }

    /** Slovak agreement form for a magnitude count: 1 → sg, 2–4 → paucal, else → genitive-plural. */
    private static string Agree(double count, Agreement forms) =>
        count == 1 ? forms.Sg : count >= 2 && count <= 4 ? forms.Paucal : forms.Plural;

    /** Read a raw digit STRING digit-by-digit (nula/jeden/…) — the fallback above the top magnitude.
     *  Operates on the string so no float precision is lost. */
    public static string ReadDigits(string digits) =>
        string.Join(" ", Js.CodePoints(digits).Select(d =>
        {
            var i = (int)Js.Number(d);
            return i >= 0 && i < UNITS.Length ? UNITS[i] : d;
        }));

    /** A non-negative integer (< 1e9) → space-separated Slovak cardinal words; at 1e9 and above, digit-by-digit
     *  from `raw` (no miliarda tier). */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (n < 0 || !double.IsFinite(n)) return "";
        n = Math.Floor(n);
        if (n == 0) return UNITS[0]; // nula
        if (n >= 1e9) return ReadDigits(raw ?? Js.NumberToString(n));
        var parts = new List<string>();
        var mil = Math.Floor(n / 1000000);
        n %= 1000000;
        if (mil != 0) parts.Add((mil == 1 ? "" : $"{Sub1000(mil)} ") + Agree(mil, MAG.Million));
        var th = Math.Floor(n / 1000);
        n %= 1000;
        if (th != 0) parts.Add(th == 1 ? MAG.Thousand.Sg : $"{Sub1000(th)} {Agree(th, MAG.Thousand)}");
        if (n != 0) parts.Add(Sub1000(n));
        return string.Join(" ", parts);
    }
}

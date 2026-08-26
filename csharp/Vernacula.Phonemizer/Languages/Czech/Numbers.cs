/**
 * Czech (cs) cardinal number compositor — returns composed Czech TEXT that Czech.cs runs back through the
 * g2p. Tens+units concatenate (dvacetjeden); magnitude nouns agree 1 / 2–4 / 5+.
 * Ported from src/languages/czech/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Czech;

public static class CzechNumbers
{
    private static CzechNumbersDef N => Manifest.MANIFEST.Numbers;
    private static string[] UNITS => N.Units;
    private static string[] TEENS => N.Teens;
    private static string[] TENS => N.Tens;
    private static string[] HUNDREDS => N.Hundreds;
    private static CzechMagnitudes MAG => N.Magnitudes;

    /** 0–99 → Czech text (tens and units CONCATENATED: dvacetjeden). */
    private static string Sub100(double n)
    {
        if (n < 10) return UNITS[(int)n];
        if (n < 20) return TEENS[(int)n - 10];
        return TENS[(int)Math.Floor(n / 10)] + (n % 10 != 0 ? UNITS[(int)(n % 10)] : "");
    }

    /** 0–999 → Czech text (hundreds space-separated from the sub-hundred remainder). */
    private static string Sub1000(double n)
    {
        double h = Math.Floor(n / 100), r = n % 100;
        if (h == 0) return Sub100(r);
        return HUNDREDS[(int)h] + (r != 0 ? $" {Sub100(r)}" : "");
    }

    /** Czech agreement form for a magnitude count: 1 → sg, 2–4 → paucal, else → genitive-plural. */
    private static string Agree(double count, Agreement forms) =>
        count == 1 ? forms.Sg : count >= 2 && count <= 4 ? forms.Paucal : forms.Plural;

    /** Read a raw digit STRING digit-by-digit — the fallback above the declared top magnitude. */
    private static string ReadDigits(string digits) =>
        string.Join(" ", Js.CodePoints(digits).Select(d =>
        {
            var i = (int)Js.Number(d);
            return i >= 0 && i < UNITS.Length ? UNITS[i] : d;
        }));

    /** A non-negative integer → space-separated Czech cardinal words; above 10^12, digit-at-a-time from
     *  `raw` (the TOKEN string — the double's digits have already rounded by then; #1059). */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (n < 0 || !double.IsFinite(n)) return "";
        n = Math.Floor(n);
        if (n == 0) return UNITS[0]; // nula
        if (n >= 1e12) return ReadDigits(raw ?? Js.NumberToString(n));
        var parts = new List<string>();
        var bil = Math.Floor(n / 1000000000);
        n %= 1000000000;
        if (bil != 0) parts.Add((bil == 1 ? "" : $"{Sub1000(bil)} ") + Agree(bil, MAG.Billion));
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

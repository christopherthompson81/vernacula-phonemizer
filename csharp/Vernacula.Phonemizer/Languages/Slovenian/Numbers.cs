/**
 * Slovenian (sl) cardinal number compositor — Germanic-style unit-in-ten inversion (21 = enaindvajset),
 * with the DUAL in the magnitude agreement.
 * Ported from src/languages/slovenian/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Slovenian;

public static class Numbers
{
    private static SlovenianNumbers N => Manifest.MANIFEST.Numbers;

    /** 0–99 → Slovene text. 21–99 non-round: unit + "in" + ten, concatenated (enaindvajset). */
    private static string Sub100(double n)
    {
        var N_ = N;
        if (n < 10) return N_.Units[(int)n];
        if (n < 20) return N_.Teens[(int)n - 10];
        var u = (int)(n % 10);
        return u == 0
            ? N_.Tens[(int)Math.Floor(n / 10)]
            : $"{N_.Units[u]}{N_.And}{N_.Tens[(int)Math.Floor(n / 10)]}";
    }

    /** 0–999 → Slovene text (hundreds space-separated from the sub-hundred remainder). */
    private static string Sub1000(double n)
    {
        var h = Math.Floor(n / 100);
        var r = n % 100;
        if (h == 0) return Sub100(r);
        return N.Hundreds[(int)h] + (r != 0 ? $" {Sub100(r)}" : "");
    }

    /** Slovene agreement form for a magnitude noun by its count: 1→sg, 2→dual, 3–4→paucal, else gen.pl. */
    private static string Agree(double count, SlovenianMagnitude forms) =>
        count == 1 ? forms.Sg : count == 2 ? forms.Dual : count <= 4 ? forms.Paucal : forms.Plural;

    /** The count NUMERAL, gender-agreeing for a standalone 2/3/4 with the magnitude noun's gender. */
    private static string CountWord(double n, string gender) =>
        N.CountForms.TryGetValue(gender, out var g) && g.TryGetValue(Js.NumberToString(n), out var w)
            ? w
            : Sub1000(n);

    /** Read a raw digit STRING digit-by-digit — the fallback for out-of-range / over-long numbers. */
    public static string ReadDigits(string digits)
    {
        var parts = new List<string>(digits.Length);
        foreach (var d in digits)
        {
            var idx = (int)Js.Number(d.ToString());
            parts.Add(idx >= 0 && idx < N.Units.Count ? N.Units[idx] : d.ToString());
        }
        return string.Join(" ", parts);
    }

    /** A non-negative integer (&lt; 1e12) → space-separated Slovene cardinal words. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (n < 0 || double.IsNaN(n) || double.IsInfinity(n)) return "";
        n = Math.Floor(n);
        if (n == 0) return N.Units[0];
        if (n >= 1e12) return ReadDigits(raw ?? Js.NumberToString(n));
        var parts = new List<string>();
        var mrd = Math.Floor(n / 1e9);
        n %= 1e9;
        if (mrd != 0)
            parts.Add(mrd == 1
                ? N.Magnitudes.Milliard.Sg
                : $"{CountWord(mrd, "f")} {Agree(mrd, N.Magnitudes.Milliard)}");
        var mil = Math.Floor(n / 1e6);
        n %= 1e6;
        if (mil != 0)
            parts.Add(mil == 1
                ? N.Magnitudes.Million.Sg
                : $"{CountWord(mil, "m")} {Agree(mil, N.Magnitudes.Million)}");
        var th = Math.Floor(n / 1000);
        n %= 1000;
        if (th != 0) parts.Add(th == 1 ? N.Thousand : $"{Sub1000(th)} {N.Thousand}");
        if (n != 0) parts.Add(Sub1000(n));
        return string.Join(" ", parts);
    }
}

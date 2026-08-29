/**
 * Abkhaz (ab) VIGESIMAL cardinal number compositor. Returns composed Abkhaz TEXT (space-separated) that
 * Abkhaz.cs runs through the g2p, so the IPA stays consistent with the word engine. This file owns the
 * COMPOSITION: the score split (floor(n/20) + a 0–19 remainder), the bare-vs-connective choice at each
 * boundary, the fused-vs-free thousands, and the digit-by-digit fallback past the миллиард group. The number
 * words themselves — with the base-20 system, the -и connective, the class-agreement judgment call and the
 * sources — live in abkhaz.jsonc.
 * Ported from src/languages/abkhaz/numbers.ts — see that file and the jsonc for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Abkhaz;

public static class Numbers
{
    private static AbkhazNumbersDef N => Manifest.MANIFEST.Numbers;
    private static IReadOnlyList<string> UNITS => N.Units;
    private static IReadOnlyList<string> TEENS => N.Teens;
    private static NumeralSeries SCORES => N.Scores;
    private static NumeralSeries HUNDREDS => N.Hundreds;
    private static AbkhazThousands THOUSANDS => N.Thousands;

    /** 0–19 → the plain Abkhaz numeral (the series that attaches after a score's -и connective). */
    private static string Sub20(int n) =>
        n < 10 ? UNITS[n] : TEENS[n - 10];

    /** 0–99 → Abkhaz text. 20–99 is score·20 + remainder, the score in its -и connective form. */
    private static string Sub100(int n)
    {
        if (n < 20) return Sub20(n);
        var s = n / 20; // 1–4 → ҩажә / ҩынҩажә / хынҩажә / ԥшьынҩажә
        var r = n - s * 20; // 0–19
        return r == 0 ? SCORES.Bare[s] : $"{SCORES.Comb[s]} {Sub20(r)}";
    }

    /** 0–999 → Abkhaz text. The round hundred takes its -и connective iff a sub-hundred remainder follows. */
    private static string Sub1000(int n)
    {
        var h = n / 100;
        var r = n % 100;
        if (h == 0) return Sub100(n);
        return r == 0 ? HUNDREDS.Bare[h] : $"{HUNDREDS.Comb[h]} {Sub100(r)}";
    }

    /** A thousands group: fused for a multiplier of 1–10 and for 100, otherwise multiplier + нызқь. */
    private static string Thousands(int count)
    {
        if (count <= 10) return THOUSANDS.Fused[count];
        if (count == 100) return THOUSANDS.Hundred;
        return $"{Sub1000(count)} {THOUSANDS.Word}";
    }

    /** Read a raw digit STRING digit-by-digit — the fallback beyond the миллиард group (n ≥ 10^12). */
    public static string ReadDigits(string digits)
    {
        var parts = new List<string>(digits.Length);
        foreach (var c in digits)
        {
            var d = c - '0';
            parts.Add(d >= 0 && d < UNITS.Count ? UNITS[d] : c.ToString());
        }
        return string.Join(" ", parts);
    }

    /** A non-negative integer (< 10^12) → space-separated Abkhaz cardinal words. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (n < 0 || !double.IsFinite(n)) return "";
        n = Math.Floor(n);
        if (n == 0) return UNITS[0]; // аноль
        if (n >= 1e12) return ReadDigits(raw ?? Js.NumberToString(n));
        var parts = new List<string>();
        var bil = (int)Math.Floor(n / 1e9);
        n %= 1e9;
        if (bil != 0) parts.Add(bil == 1 ? N.Milliard : $"{Sub1000(bil)} {N.Milliard}");
        var mil = (int)Math.Floor(n / 1e6);
        n %= 1e6;
        if (mil != 0) parts.Add(mil == 1 ? N.Million : $"{Sub1000(mil)} {N.Million}");
        var th = (int)Math.Floor(n / 1000);
        n %= 1000;
        if (th != 0) parts.Add(Thousands(th));
        if (n != 0) parts.Add(Sub1000((int)n));
        return string.Join(" ", parts);
    }
}

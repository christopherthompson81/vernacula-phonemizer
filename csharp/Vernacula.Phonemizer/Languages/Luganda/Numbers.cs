/**
 * Luganda / Oluganda (lg) cardinal number → words (space-separated; each word then runs through the g2p, so
 * the IPA stays consistent with the word engine). The CITATION / COUNTING series, the multiplicative amakumi
 * tens against the SINGLE-NOUN 60–90, the per-magnitude concord series (a- / bi- / bu-) and the na/n'/mu
 * connectives.
 * Ported from src/languages/luganda/numbers.ts — see that file for the sourcing and for why every magnitude
 * needs its own multiplier series.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Luganda;

public static class Numbers
{
    private static LugandaNumbers N => Manifest.MANIFEST.Numbers;

    /** `Number.isSafeInteger` — the local idiom the fleet uses; there is no BCL equivalent. */
    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    private static readonly JsRe VOWEL_INITIAL = JsRegex.Compile("^[aeiou]", "u");

    /** 1 ≤ n < 100 — teens use na/n', the tens+unit join uses "mu". */
    private static string Below100(double n)
    {
        if (n < 10) return N.Units[(int)n];
        var t = (int)Math.Floor(n / 10);
        var u = (int)(n % 10);
        if (t == 1)
        {
            if (u == 0) return N.Ten;
            // kkumi n'emu (elision before the vowel-initial emu) vs kkumi na bbiri
            var unit = N.Units[u];
            return VOWEL_INITIAL.IsMatch(unit)
                ? $"{N.Ten} {N.AndTeenElided}{unit}"
                : $"{N.Ten} {N.AndTeen} {unit}";
        }
        return u == 0 ? N.Tens[t] : $"{N.Tens[t]} {N.Mu} {N.Units[u]}";
    }

    /** 1 ≤ n < 1000. */
    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        var h = (int)Math.Floor(n / 100);
        var r = n % 100;
        var hundred = h == 1 ? N.HundredOne : $"{N.Hundreds} {N.HundredsMult[h]}";
        return r != 0 ? $"{hundred} {N.Mu} {Below1000(r)}" : hundred;
    }

    /** The class-14 (obukadde/obuwumbi) multiplier: the bu- concord for 2–9, else the number rendered
     *  recursively. */
    private static string BuMultiplier(double k) =>
        k >= 2 && k <= 9 ? N.BuMult[(int)k] : NumberToWords(k);

    /** A non-negative integer → space-separated Luganda cardinal words. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!IsSafeInteger(n) || n < 0)
            return string.Join(" ", Js.CodePoints(raw ?? Js.NumberToString(Math.Abs(n))).Select(d =>
            {
                if (d == "0") return N.Zero;
                // ⚠ JS `N.units[Number(d)] ?? d` on a NON-DIGIT (`String(1e21)` is "1e+21") indexes with NaN,
                // yields undefined and falls back to the CHARACTER ITSELF. Reproduced explicitly.
                var v = Js.Number(d);
                return double.IsInteger(v) && v >= 0 && v < N.Units.Count ? N.Units[(int)v] : d;
            }));
        if (n == 0) return N.Zero;
        var parts = new List<string>();
        var b = Math.Floor(n / 1e9);
        if (b > 0) parts.Add(b == 1 ? N.BillionOne : $"{N.Billions} {BuMultiplier(b)}");
        var m = Math.Floor(n % 1e9 / 1e6);
        if (m > 0) parts.Add(m == 1 ? N.MillionOne : $"{N.Millions} {BuMultiplier(m)}");
        var th = Math.Floor(n % 1e6 / 1000);
        if (th > 0) parts.Add(th == 1 ? N.ThousandOne : $"{N.Thousands} {NumberToWords(th)}");
        var r = n % 1000;
        if (r > 0) parts.Add(Below1000(r));
        return string.Join($" {N.Mu} ", parts);
    }
}

/**
 * Umbundu (umb) cardinal number → words (space-separated; each word then runs through the g2p, so the IPA
 * stays consistent with the word engine).
 * Ported from src/languages/umbundu/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Umbundu;

public static class Numbers
{
    private static UmbunduNumbers N => Manifest.MANIFEST.Numbers;

    private static readonly JsRe VOWEL_INITIAL = JsRegex.Compile("^[aeiouãẽĩõũ]", "u");

    /** Chain the magnitude components with the connective "la", elided to "l'" before a vowel. */
    private static string Join(IReadOnlyList<string> parts)
    {
        var acc = "";
        foreach (var p in parts)
            acc = acc == "" ? p : VOWEL_INITIAL.IsMatch(p) ? $"{acc} {N.AndElided}{p}" : $"{acc} {N.And} {p}";
        return acc;
    }

    /**
     * The magnitude components of 1 ≤ n, outermost first.
     * `top` = this is a bare numeral, so the citation unit series is used.
     */
    private static List<string> Components(double n, bool top)
    {
        var parts = new List<string>();
        var m = Math.Floor(n / 1e6);
        if (m > 0) parts.Add(m == 1 ? N.Million : $"{N.Million} {Multiplier(m)}");
        var th = Math.Floor(n % 1e6 / 1000);
        if (th > 0) parts.Add(th == 1 ? N.Thousand : $"{N.Thousand} {Multiplier(th)}");
        var h = (int)Math.Floor(n % 1000 / 100);
        if (h == 1) parts.Add(N.HundredOne);
        else if (h > 1) parts.Add($"{N.Hundreds} {N.HundredsMult[h]}");
        var t = (int)Math.Floor(n % 100 / 10);
        if (t == 1) parts.Add(N.Ten);
        else if (t > 1) parts.Add($"{N.Tens} {N.TensMult[t]}");
        var u = (int)(n % 10);
        if (u > 0) parts.Add(top && parts.Count == 0 ? N.Units[u] : N.Additive[u]);
        return parts;
    }

    /** The multiplier of ohulukãyi / ohulua: the cl.8 series for 2–9, else the count rendered recursively. */
    private static string Multiplier(double k) =>
        k >= 2 && k <= 9 ? N.HundredsMult[(int)k] : Join(Components(k, false));

    /** A non-negative integer → space-separated Umbundu cardinal words. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0)
            // ⚠ CODE POINTS, NOT CHARS. The TS spreads the string (`[...raw]`), which yields whole code
            // points; iterating a C# string yields UTF-16 CODE UNITS, so an astral character came back as
            // two LONE SURROGATES with a space between them — malformed UTF-16 in the phoneme stream.
            return string.Join(" ", Js.CodePoints(raw ?? Js.NumberToString(Math.Abs(n))).Select(d =>
                d == "0" ? N.Zero : Core.Numbers.DigitWord(N.Units, d) ?? d));
        if (n == 0) return N.Zero;
        return Join(Components(n, true));
    }
}

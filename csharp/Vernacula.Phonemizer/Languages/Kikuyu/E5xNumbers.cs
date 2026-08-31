/**
 * SHARED cardinal compositor for the Central-Kenya Bantu E5x pair — Kikuyu / Gĩkũyũ (ki) and Kamba /
 * Kĩkamba (kam): the two languages have the same numeral SHAPE (only the words differ), so the
 * algorithm lives here once and each language supplies its own table.
 * Ported from src/languages/kikuyu/e5xNumbers.ts — see that file for the attested Kikamba strings that
 * pin the "na"-before-the-last-component rule.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kikuyu;

/** The per-language word table for the shared E5x composer. Index 0 of the *Mult arrays is unused. */
public sealed class E5xNumberTable
{
    public string Zero { get; init; } = "";
    public string[] Units { get; init; } = [];
    public string Ten { get; init; } = "";
    public string Tens { get; init; } = "";
    public string[] TensMult { get; init; } = [];
    public string HundredOne { get; init; } = "";
    public string HundredRest { get; init; } = "";
    public string Hundreds { get; init; } = "";
    public string[] HundredsMult { get; init; } = [];
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
    public string And { get; init; } = "";
}

public static class E5xNumbers
{
    /** The magnitude components of 1 ≤ n < 10⁹⁺, outermost first (million, thousand, hundred, ten, unit). */
    private static List<string> Components(double n, E5xNumberTable T)
    {
        var parts = new List<string>();
        var m = Math.Floor(n / 1e6);
        if (m > 0) parts.Add($"{T.Million} {Render(m, T)}");
        var th = Math.Floor((n % 1e6) / 1000);
        if (th > 0) parts.Add($"{T.Thousand} {Render(th, T)}");
        var h = Math.Floor((n % 1000) / 100);
        if (h == 1) parts.Add(n % 100 == 0 ? T.HundredOne : T.HundredRest);
        else if (h > 1) parts.Add($"{T.Hundreds} {T.HundredsMult[(int)h]}");
        var t = Math.Floor((n % 100) / 10);
        if (t == 1) parts.Add(T.Ten);
        else if (t > 1) parts.Add($"{T.Tens} {T.TensMult[(int)t]}");
        var u = n % 10;
        if (u > 0) parts.Add(T.Units[(int)u]);
        return parts;
    }

    /** 1 ≤ n → the components juxtaposed, with the connective `na` before the LAST one only (the attested rule). */
    private static string Render(double n, E5xNumberTable T)
    {
        var parts = Components(n, T);
        if (parts.Count == 1) return parts[0];
        return $"{string.Join(" ", parts.Take(parts.Count - 1))} {T.And} {parts[^1]}";
    }

    /** A non-negative integer → space-separated E5x cardinal words. Composes every value up to 2⁵³ (billions are
     *  "thousands of millions"); only a digit string too long to be an exact double degrades to digit-by-digit. */
    public static string RenderE5xNumber(double n, E5xNumberTable T, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0)
            return string.Join(" ", Js.CodePoints(raw ?? Js.NumberToString(Math.Abs(n))).Select(d =>
                d == "0" ? T.Zero : Core.Numbers.DigitWord(T.Units, d) ?? d)); // qualified: Kikuyu.Numbers shadows Core.Numbers here
        if (n == 0) return T.Zero;
        return Render(n, T);
    }
}

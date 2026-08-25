/**
 * Igbo cardinal number → words (space-separated; each runs through the g2p). MAGNITUDE FIRST, multiplier
 * second, `na` joining the parts; digit-by-digit in Igbo units above 10¹² and for non-finite input, so no
 * digit can escape to the English foreign path.
 * Ported from src/languages/igbo/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Igbo;

public static class Numbers
{
    private static IgboNumbersDef N => Manifest.MANIFEST.Numbers;

    /** JS `units[i]` — `undefined` (null here) for a non-index, which the callers below rely on. */
    private static string? Unit(double i) =>
        double.IsInteger(i) && i >= 0 && i < N.Units.Length ? N.Units[(int)i] : null;

    /** A magnitude and its multiplier: `iri abụọ`, and the irregular `otu narị` when the multiplier is 1. */
    private static string Scaled(string magnitude, double multiplier) =>
        multiplier == 1 ? $"{N.One} {magnitude}" : $"{magnitude} {Unit(multiplier)}";

    /** 1 ≤ n < 100. `iri` alone is 10; `iri abụọ` is 20; `na` joins a unit remainder. */
    private static string Below100(double n)
    {
        if (n < 10) return n == 1 ? N.One : Unit(n)!;
        double t = Math.Floor(n / 10), u = n % 10;
        var tens = t == 1 ? N.Ten : $"{N.Ten} {Unit(t)}";
        return u == 0 ? tens : $"{tens} {N.And} {(u == 1 ? N.One : Unit(u))}";
    }

    /** 1 ≤ n < 1000. */
    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        double h = Math.Floor(n / 100), r = n % 100;
        var hundreds = Scaled(N.Hundred, h);
        return r == 0 ? hundreds : $"{hundreds} {N.And} {Below100(r)}";
    }

    /** A magnitude group and its remainder; the multiplier is itself a full number, so it recurses. */
    private static string Group(double n, double size, string magnitude)
    {
        double count = Math.Floor(n / size), rest = n % size;
        var head = count == 1 ? $"{N.One} {magnitude}" : $"{magnitude} {Below1000(count)}";
        return rest == 0 ? head : $"{head} {N.And} {ToWords(rest)}";
    }

    /** Digit-by-digit, in Igbo units — the floor that keeps any digit from reaching the English fallback. */
    private static string Digits(string s)
    {
        var parts = new List<string>();
        foreach (var d in Js.CodePoints(s))
        {
            var w = d == "0" ? N.Zero : d == "1" ? N.One : Unit(Js.Number(d)) ?? d;
            if (w.Length > 0) parts.Add(w); // JS `.filter(Boolean)` — an unused units slot is "" and drops out
        }
        return string.Join(" ", parts);
    }

    private static string ToWords(double n)
    {
        if (n == 0) return N.Zero;
        if (n < 1000) return Below1000(n);
        if (n < 1_000_000) return Group(n, 1000, N.Thousand);
        if (n < 1_000_000_000) return Group(n, 1_000_000, N.Million);
        if (n < 1_000_000_000_000) return Group(n, 1_000_000_000, N.Billion);
        return "";
    }

    /** An Igbo cardinal for `n`, or a digit-by-digit reading when it is out of range or not a finite integer. */
    public static string NumberToWords(double n)
    {
        if (!double.IsFinite(n) || !double.IsInteger(n) || n < 0) return Digits(Js.NumberToString(n));
        var words = ToWords(n);
        return words == "" ? Digits(Js.NumberToString(n)) : words;
    }
}

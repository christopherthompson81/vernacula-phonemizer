/**
 * Madurese cardinal number → words (space-separated; each word runs through the g2p). Covers 0 … <10¹⁵;
 * larger / non-safe / non-finite degrade to digit-at-a-time.
 * Ported from src/languages/madurese/numbers.ts — see that file for the sourcing of the magnitude series.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Madurese;

public static class Numbers
{
    private static MadureseNumbersDef N => Manifest.MANIFEST.Numbers;

    private static string Below100(double n)
    {
        if (n < 10) return N.Units[(int)n];
        if (n == 10) return N.Ten;
        var t = Math.Floor(n / 10);
        var u = n % 10;
        var tens = t == 1 ? N.Ten : $"{N.Units[(int)t]} {N.Tens}";
        return u != 0 ? $"{tens} {N.And} {N.Units[(int)u]}" : tens;
    }

    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        var h = Math.Floor(n / 100);
        var r = n % 100;
        var hundred = h == 1 ? N.Hundred : $"{N.Units[(int)h]} {N.Hundred}";
        return r != 0 ? $"{hundred} {N.And} {Below100(r)}" : hundred;
    }

    /** The magnitude series, LARGEST FIRST — multiplier then magnitude, descending. */
    private static readonly IReadOnlyList<(double Value, string Word)> Scales =
    [
        (1e12, N.Trillion),
        (1e9, N.Billion),
        (1e6, N.Million),
        (1e3, N.Thousand),
    ];

    /** The largest authored magnitude × 1000 — the first quantity this series cannot name. */
    private const double CAP = 1e15;

    public static string NumberToWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= CAP)
        {
            // TS `N.units[Number(d)] ?? d`: a non-digit character indexes with NaN and falls back to itself.
            var src = raw ?? Js.NumberToString(Math.Abs(n));
            return string.Join(" ", Js.CodePoints(src).Select(d =>
            {
                var i = Js.Number(d);
                return double.IsInteger(i) && i >= 0 && i < N.Units.Count ? N.Units[(int)i] : d;
            }));
        }
        if (n == 0) return N.Units[0];
        foreach (var (value, word) in Scales)
        {
            if (n < value) continue;
            var count = Math.Floor(n / value);
            var r = n % value;
            var head = count == 1 ? word : $"{NumberToWords(count)} {word}";
            return r != 0 ? $"{head} {N.And} {NumberToWords(r)}" : head;
        }
        return Below1000(n);
    }
}

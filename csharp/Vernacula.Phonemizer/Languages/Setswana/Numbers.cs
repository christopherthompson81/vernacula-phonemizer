/**
 * Setswana cardinal number → words (space-separated; each runs through the g2p). The bo- counting series,
 * the ma- tens/hundreds multipliers, the dikete thousands, and a digit-by-digit degrade at ≥10⁶.
 * Ported from src/languages/setswana/numbers.ts — see that file for the Mistry Cycle 29 sourcing and for the
 * note that the numbers are unmeasured (the referee is word-only).
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Setswana;

public static class Numbers
{
    private static SetswanaNumbers N => Manifest.MANIFEST.Numbers;

    /** `Number.isSafeInteger` — the local idiom the fleet uses; there is no BCL equivalent. */
    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    private static string Below100(double n)
    {
        if (n < 10) return N.Units[(int)n];
        if (n == 10) return N.Ten;
        var t = (int)Math.Floor(n / 10);
        var u = (int)(n % 10);
        // 11-19 = "lesome le <unit>"; 20-99 = "masome a <mult>" (+ " le <unit>")
        var tens = t == 1 ? N.Ten : $"{N.TensWord} {N.Of} {N.Mult[t]}";
        return u != 0 ? $"{tens} {N.And} {N.Units[u]}" : tens;
    }

    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        var h = (int)Math.Floor(n / 100);
        var r = n % 100;
        var hundred = h == 1 ? N.Hundred : $"{N.HundredsWord} {N.Of} {N.Mult[h]}";
        return r != 0 ? $"{hundred} {N.And} {Below100(r)}" : hundred;
    }

    public static string NumberToWords(double n, string? raw = null)
    {
        if (!IsSafeInteger(n) || n < 0 || n >= 1e6)
        {
            return string.Join(" ", Js.CodePoints(raw ?? Js.NumberToString(Math.Abs(n))).Select(d =>
            {
                if (d == "0") return N.Zero;
                // ⚠ JS `N.units[Number(d)]` on a NON-DIGIT (`String(1e21)` is "1e+21") indexes with NaN and
                // yields undefined, which `join` renders as the EMPTY STRING. Reproduced explicitly.
                var v = Js.Number(d);
                return double.IsInteger(v) && v >= 0 && v < N.Units.Count ? N.Units[(int)v] : "";
            }));
        }
        if (n == 0) return N.Zero;
        if (n < 1000) return Below1000(n);
        var th = Math.Floor(n / 1000);
        var r = n % 1000;
        // 1000 = sekete; k×1000 = "dikete tse <di-mult>" for 2..9; 10..999 thousands → "dikete tse " + below1000
        var thousand = th == 1
            ? N.Thousand
            : $"{N.ThousandsWord} {N.These} {(th < 10 ? N.DiMult[(int)th] : Below1000(th))}";
        return r != 0 ? $"{thousand} {N.And} {Below1000(r)}" : thousand;
    }
}

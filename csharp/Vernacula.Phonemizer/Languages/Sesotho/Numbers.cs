/**
 * Sesotho (st) cardinal number → words. A BARE integer 1–9 takes the citation/counting stem; the units slot
 * INSIDE a compound takes the noun-free motso/metso device. Tens and hundreds are multiplicative with cl.6
 * concord, thousands and above are cl.7/8 nouns, and components chain with `le`.
 * Ported from src/languages/sesotho/numbers.ts — see that file for why two numeral forms are emitted and
 * why each magnitude selects its own concord series.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Sesotho;

public static class Numbers
{
    private static SesothoNumbers N => Manifest.MANIFEST.Numbers;

    /** `Number.isSafeInteger` — the local idiom the fleet uses; there is no BCL equivalent. */
    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    /** The units slot of a compound: the motso/metso dummy-noun construction. */
    private static string UnitPart(int u) => u == 1 ? N.UnitOne : $"{N.UnitNoun} {N.Class4[u]}";

    /** A cl.8 magnitude + its multiplier: "tse" + cl.8 stem for 2–9, else recursive. */
    private static string Class8Multiple(string head, double k) =>
        k >= 2 && k <= 9 ? $"{head} {N.Class8Concord} {N.Class8[(int)k]}" : $"{head} {NumberToWords(k)}";

    /** A non-negative integer → space-separated Sesotho cardinal words. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!IsSafeInteger(n) || n < 0)
        {
            return string.Join(" ", Js.CodePoints(raw ?? Js.NumberToString(Math.Abs(n))).Select(d =>
            {
                if (d == "0") return N.Zero;
                // JS `N.units[Number(d)] ?? d` — a non-digit indexes with NaN and falls through to the
                // character itself.
                var v = Js.Number(d);
                return double.IsInteger(v) && v >= 0 && v < N.Units.Count ? N.Units[(int)v] : d;
            }));
        }
        if (n == 0) return N.Zero;
        if (n < 10) return N.Units[(int)n]; // a BARE numeral → the citation/counting stem
        var parts = new List<string>();
        var b = Math.Floor(n / 1e9);
        if (b > 0) parts.Add(b == 1 ? N.BillionOne : Class8Multiple(N.Billions, b));
        var m = Math.Floor(n % 1e9 / 1e6);
        if (m > 0) parts.Add(m == 1 ? N.MillionOne : Class8Multiple(N.Millions, m));
        var th = Math.Floor(n % 1e6 / 1000);
        if (th > 0) parts.Add(th == 1 ? N.ThousandOne : Class8Multiple(N.Thousands, th));
        var h = Math.Floor(n % 1000 / 100);
        if (h == 1) parts.Add(N.HundredOne);
        else if (h > 1) parts.Add($"{N.Hundreds} {N.Class6[(int)h]}");
        var t = Math.Floor(n % 100 / 10);
        if (t == 1) parts.Add(N.Ten);
        else if (t > 1) parts.Add($"{N.Tens} {N.Class6[(int)t]}");
        var u = n % 10;
        if (u > 0) parts.Add(UnitPart((int)u));
        return string.Join($" {N.And} ", parts);
    }
}

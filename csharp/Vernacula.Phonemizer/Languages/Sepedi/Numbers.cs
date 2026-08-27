/**
 * Sepedi / Northern Sotho (nso) cardinal number → words. The CITATION / COUNTING series, with Northern
 * Sotho's CONJUNCTIVE compounds — 11–99 and 200–900 are a single word with the bare stem glued to the
 * magnitude noun (lesometee, masomepedi, makgolopedi) — and the cl.8 particle only at dikete and above.
 * Ported from src/languages/sepedi/numbers.ts — see that file for why the sibling Sesotho compositor is
 * deliberately NOT reused.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Sepedi;

public static class Numbers
{
    private static SepediNumbers N => Manifest.MANIFEST.Numbers;

    /** `Number.isSafeInteger` — the local idiom the fleet uses; there is no BCL equivalent. */
    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    /** A cl.8 magnitude + its multiplier: "tše" + cl.8 stem for 2–9, else recursive. */
    private static string Class8Multiple(string head, double k) =>
        k >= 2 && k <= 9 ? $"{head} {N.Class8Concord} {N.Class8[(int)k]}" : $"{head} {NumberToWords(k)}";

    /** 1 ≤ n < 100 — the conjunctive teens/tens compound (one word), with the unit a separate word after a
     *  tens. */
    private static string Below100(double n)
    {
        if (n < 10) return N.Units[(int)n];
        var t = (int)Math.Floor(n / 10);
        var u = (int)(n % 10);
        // 11–19 glue onto lesome as ONE word (lesometee); 10 itself is bare lesome.
        if (t == 1) return u == 0 ? N.Ten : $"{N.TeenHead}{N.Units[u]}";
        // 20–90 glue onto masome as ONE word (masomepedi); a following unit is its own word.
        var tens = $"{N.TensHead}{N.Units[t]}";
        return u == 0 ? tens : $"{tens} {N.Units[u]}";
    }

    /** A non-negative integer → space-separated Sepedi cardinal words. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!IsSafeInteger(n) || n < 0)
        {
            return string.Join(" ", Js.CodePoints(raw ?? Js.NumberToString(Math.Abs(n))).Select(d =>
            {
                if (d == "0") return N.Zero;
                // JS `N.units[Number(d)] ?? d` — a non-digit indexes with NaN and falls through to the
                // character itself. ⚠ This is the path that voices the ⟨e⟩ of `2.658e+42`; see the TS.
                var v = Js.Number(d);
                return double.IsInteger(v) && v >= 0 && v < N.Units.Count ? N.Units[(int)v] : d;
            }));
        }
        if (n == 0) return N.Zero;
        var parts = new List<string>();
        var b = Math.Floor(n / 1e9);
        if (b > 0) parts.Add(b == 1 ? N.BillionOne : Class8Multiple(N.Billions, b));
        var m = Math.Floor(n % 1e9 / 1e6);
        if (m > 0) parts.Add(m == 1 ? N.MillionOne : Class8Multiple(N.Millions, m));
        var th = Math.Floor(n % 1e6 / 1000);
        if (th > 0) parts.Add(th == 1 ? N.ThousandOne : Class8Multiple(N.Thousands, th));
        var h = Math.Floor(n % 1000 / 100);
        if (h == 1) parts.Add(N.HundredOne);
        else if (h > 1) parts.Add($"{N.HundredsHead}{N.Units[(int)h]}");
        var r = n % 100;
        if (r > 0) parts.Add(Below100(r));
        return string.Join($" {N.And} ", parts);
    }
}

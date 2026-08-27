/**
 * Kinyarwanda cardinal number → words (space-separated; each runs through the g2p). Holds the shared
 * RWANDA-RUNDI compositor: Kirundi passes its own word table to the same algorithm.
 * Ported from src/languages/kinyarwanda/numbers.ts — see that file for the noun-class concord evidence,
 * for the per-magnitude multiplier series, and for why rw has a `billion` word and rn does not.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kinyarwanda;

public static class Numbers
{
    /** Compose `n` in a Rwanda-Rundi language from its own word table. */
    public static string ComposeRwandaRundi(double n, RwandaRundiNumbers N, string? raw = null)
    {
        /** 1 ≤ n < 100. */
        string Below100(double v)
        {
            if (v < 10) return N.Units[(int)v];
            if (v == 10) return N.Ten;
            var t = Math.Floor(v / 10);
            var u = v % 10;
            var tens = t == 1 ? N.Ten : N.Tens[(int)t];
            return u != 0 ? $"{tens} {N.And} {N.Units[(int)u]}" : tens;
        }

        /** 1 ≤ n < 1000. */
        string Below1000(double v)
        {
            if (v < 100) return Below100(v);
            var h = Math.Floor(v / 100);
            var r = v % 100;
            var hundred = h == 1 ? N.Hundred : $"{N.Hundreds} {N.HundredsMul[(int)h]}";
            return r != 0 ? $"{hundred} {N.And} {Below100(r)}" : hundred;
        }

        /** 1 ≤ n < 10⁶. */
        string Below1e6(double v)
        {
            if (v < 1000) return Below1000(v);
            var th = Math.Floor(v / 1000);
            var r = v % 1000;
            var thousand = th == 1
                ? N.Thousand
                : th < 10 ? $"{N.Thousands} {N.ThousandsMul[(int)th]}" : $"{N.Thousands} {Below1000(th)}";
            return r != 0 ? $"{thousand} {N.And} {Below1e6(r)}" : thousand;
        }

        /** 1 ≤ n < 10⁹. */
        string Below1e9(double v)
        {
            if (v < 1e6) return Below1e6(v);
            var m = Math.Floor(v / 1e6);
            var r = v % 1e6;
            var million = m == 1 ? N.Million : $"{N.Million} {Below1000(m)}";
            return r != 0 ? $"{million} {N.And} {Below1e6(r)}" : million;
        }

        // The ceiling is what the TABLE can say: 10¹² where a `billion` word is authored, 10⁹ where it is
        // not. ⚠ JS truthiness on `N.billion` — an absent word and an EMPTY one both mean "no ceiling here".
        var ceiling = !string.IsNullOrEmpty(N.Billion) ? 1e12 : 1e9;
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= ceiling)
            return string.Join(" ", Js.CodePoints(raw ?? Js.NumberToString(Math.Abs(n))).Select(d =>
            {
                // JS `N.units[Number(d)] ?? d`: a non-digit code point indexes with NaN, misses, and falls
                // back to the character itself.
                var i = Js.Number(d);
                return double.IsInteger(i) && i >= 0 && i < N.Units.Length ? N.Units[(int)i] : d;
            }));
        if (n == 0) return N.Units[0];
        if (n < 1e9) return Below1e9(n);
        var b = Math.Floor(n / 1e9);
        var rem = n % 1e9;
        var billion = b == 1 ? N.Billion! : $"{N.Billion!} {Below1000(b)}";
        return rem != 0 ? $"{billion} {N.And} {Below1e9(rem)}" : billion;
    }

    /** Non-negative integer (< 10¹²) → Kinyarwanda words; larger / non-finite → digit-by-digit. */
    public static string NumberToWords(double n, string? raw = null) =>
        ComposeRwandaRundi(n, Manifest.MANIFEST.Numbers, raw);
}

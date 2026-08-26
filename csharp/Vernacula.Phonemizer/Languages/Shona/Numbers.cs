/**
 * Shona cardinal number → words (space-separated; each runs through the g2p). 0 … <10¹²; larger or
 * non-finite falls back to digit-by-digit. Also the class-6 concord re-cast the normalizer applies beside
 * a measure or currency noun.
 * Ported from src/languages/shona/numbers.ts — see that file for the noun-class concord evidence behind
 * the two count series, for why `chiuru` (not `churu`) is the thousand, and for the trap-14 argument.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Shona;

public static class Numbers
{
    private static ShonaNumbersDef N => Manifest.MANIFEST.Numbers;

    /** A magnitude noun plus its count: singular noun alone for one, else plural noun + the concorded
     *  numeral. `count` is the concord series for that noun's class. */
    private static string Magnitude(string one, string many, double n, IReadOnlyList<string> count)
    {
        if (n == 1) return one;
        // ⚠ JS `count[n] ?? below1000(n)`: an INDEX PAST THE END is undefined and falls through, but the
        // empty strings at 0/1 are NOT nullish and would be returned. Reproduced, not "fixed".
        var i = (int)n;
        return $"{many} {(n >= 0 && n < count.Count && double.IsInteger(n) ? count[i] : Below1000(n))}";
    }

    /** 1 ≤ n < 100. */
    private static string Below100(double n)
    {
        if (n < 10) return N.Units[(int)n];
        if (n == 10) return N.Ten;
        var t = Math.Floor(n / 10);
        var u = n % 10;
        var tens = Magnitude(N.Ten, N.Tens, t, N.UnitsMa);
        return u != 0 ? $"{tens} {N.And} {N.Units[(int)u]}" : tens;
    }

    /** 1 ≤ n < 1000. */
    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        var h = Math.Floor(n / 100);
        var r = n % 100;
        var hundred = Magnitude(N.Hundred, N.Hundreds, h, N.UnitsMa);
        return r != 0 ? $"{hundred} {N.And} {Below100(r)}" : hundred;
    }

    /** 1 ≤ n < 10⁶. */
    private static string Below1e6(double n)
    {
        if (n < 1000) return Below1000(n);
        var th = Math.Floor(n / 1000);
        var r = n % 1000;
        var thousand = Magnitude(N.Thousand, N.Thousands, th, N.UnitsZvi);
        return r != 0 ? $"{thousand} {N.And} {Below1000(r)}" : thousand;
    }

    /** Non-negative integer (< 10¹²) → Shona words; larger / non-finite → digit-by-digit. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e12)
            // ⚠ `raw` KEEPS THE TAIL OF A LONG DIGIT RUN: past 2^53 the double has already lost digits, so
            // String(n) is not what the writer typed. The tokenizer passes the source string.
            return string.Join(" ", Js.CodePoints(raw ?? Js.NumberToString(Math.Abs(n))).Select(d =>
            {
                // JS `N.units[Number(d)] ?? d`: a non-digit code point indexes with NaN, misses, and falls
                // back to the character itself.
                var i = Js.Number(d);
                return double.IsInteger(i) && i >= 0 && i < N.Units.Length ? N.Units[(int)i] : d;
            }));
        if (n == 0) return N.Units[0];
        if (n < 1e6) return Below1e6(n);
        var scale = n >= 1e9 ? 1e9 : 1e6;
        var one = scale == 1e9 ? N.Billion : N.Million;
        var many = scale == 1e9 ? N.Billions : N.Millions;
        var head = Math.Floor(n / scale);
        var r = n % scale;
        var big = head < 10 ? Magnitude(one, many, head, N.UnitsMa) : $"{many} {Below1000(head)}";
        return r != 0 ? $"{big} {N.And} {NumberToWords(r)}" : big;
    }

    /** Re-cast a composed numeral so its FINAL stem carries the class-6 (ma-) concord — `piri` → `maviri`.
     *  Only the last word moves; "one" is excluded (class 6 is a plural). */
    public static string WithClass6Concord(string words)
    {
        var parts = words.Split(' ');
        var last = parts.Length - 1;
        var k = Array.IndexOf(N.Units, parts[last]);
        if (k >= 2 && k < N.UnitsMa.Length && !string.IsNullOrEmpty(N.UnitsMa[k])) parts[last] = N.UnitsMa[k];
        return string.Join(" ", parts);
    }
}

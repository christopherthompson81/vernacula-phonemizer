/**
 * Turkish cardinal number → words (space-separated).
 * Ported from src/languages/turkish/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Turkish;

public static class TurkishNumbers
{
    private static TurkishNumbersDef N => Manifest.MANIFEST.Numbers;
    private static string[] ONES => N.Ones;
    private static string[] TENS => N.Tens;
    private static string[] SCALES => N.Scales;

    /** 1 ≤ n < 1000 → words. */
    private static List<string> Below1000(double n)
    {
        var parts = new List<string>();
        double h = Math.Floor(n / 100), t = Math.Floor(n % 100 / 10), o = n % 10;
        if (h > 0)
        {
            if (h > 1) parts.Add(ONES[(int)h]);
            parts.Add(N.Hundred);
        } // "yüz", not "bir yüz"
        if (t > 0) parts.Add(TENS[(int)t]);
        if (o > 0) parts.Add(ONES[(int)o]);
        return parts;
    }

    /** Little-endian thousands groups (groups[g] multiplies 10³ᵍ) → words; "" when there are more groups than
     *  scale words. */
    private static string ComposeGroups(List<double> groups)
    {
        if (groups.Count > SCALES.Length) return "";
        var parts = new List<string>();
        for (var g = groups.Count - 1; g >= 0; g--)
        {
            var v = groups[g];
            if (v == 0) continue;
            if (g == 1 && v == 1)
            {
                parts.Add(SCALES[1]);
                continue;
            } // "bin", not "bir bin"
            parts.AddRange(Below1000(v));
            if (g > 0) parts.Add(SCALES[g]);
        }
        return string.Join(" ", parts);
    }

    /** Non-negative integer → Turkish words. "" past the largest scale word (10³⁶ and up); a written numeral
     *  goes through `DigitsToWords`, which keeps every digit. */
    public static string NumberToWords(double n)
    {
        if (!double.IsFinite(n) || n < 0) return "";
        if (n == 0) return N.Zero;
        var groups = new List<double>();
        var x = Math.Floor(n);
        while (x > 0)
        {
            groups.Add(x % 1000);
            x = Math.Floor(x / 1000);
        }
        return ComposeGroups(groups);
    }

    private static readonly JsRe LEADING_ZEROS = JsRegex.Compile("^0+(?=\\d)", "u");

    /** A written digit string → words, grouped from the STRING (past 2⁵³ `Number()` has already rounded it);
     *  more groups than scale words → digit by digit (#1523). See numbers.ts. */
    public static string DigitsToWords(string digits)
    {
        var d = JsRegex.Replace(digits, LEADING_ZEROS, _ => "");
        if (d == "0") return N.Zero;
        var groups = new List<double>();
        for (var end = d.Length; end > 0; end -= 3)
            groups.Add(Js.Number(d[Math.Max(0, end - 3)..end]));
        if (groups.Count > SCALES.Length)
            return string.Join(" ", d.Select(c => c == '0' ? N.Zero : ONES[c - '0']));
        return ComposeGroups(groups);
    }
}

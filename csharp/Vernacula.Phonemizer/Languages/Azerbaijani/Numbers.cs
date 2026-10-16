/**
 * Azerbaijani cardinal number → words (space-separated); thousands scale, "bir" dropped before yüz/min.
 * Ported from src/languages/azerbaijani/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Azerbaijani;

public static class AzerbaijaniNumbers
{
    private static AzerbaijaniNumbersDef N => Manifest.MANIFEST.Numbers;
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

    /** Little-endian thousands groups → words; "" when there are more groups than scale words. */
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
            } // "min", not "bir min"
            parts.AddRange(Below1000(v));
            if (g > 0) parts.Add(SCALES[g]);
        }
        return string.Join(" ", parts);
    }

    /** Non-negative integer → Azerbaijani words; "" past 2⁵³, whose low digits the double has lost — a written
     *  numeral goes through `DigitsToWords` (#1576). */
    public static string NumberToWords(double n)
    {
        if (!double.IsFinite(n) || n < 0) return "";
        var x = Math.Floor(n);
        if (!Js.IsSafeInteger(x)) return "";
        if (x == 0) return N.Zero;
        var groups = new List<double>();
        for (var y = x; y > 0; y = Math.Floor(y / 1000)) groups.Add(y % 1000);
        return ComposeGroups(groups);
    }

    private static readonly JsRe LEADING_ZEROS = JsRegex.Compile("^0+(?=\\d)", "u");

    /** A written digit string → words, grouped from the STRING (tr's #1523 shape); more groups than scale words →
     *  digit by digit (#1576). See numbers.ts. */
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

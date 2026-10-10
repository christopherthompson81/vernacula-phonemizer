/**
 * Spanish number → words (long scale: millón = 10⁶).
 * Ported from src/languages/spanish/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Spanish;

public static class Numbers
{
    private static SpanishNumbers N => Manifest.MANIFEST.Numbers;
    private static IReadOnlyList<string> ONES => N.Ones;
    private static IReadOnlyList<string> TENS => N.Tens;
    private static IReadOnlyList<string> HUNDREDS => N.Hundreds;

    /** 0 ≤ n < 100 */
    private static string Below100(double n)
    {
        if (n < 30) return ONES[(int)n];
        int t = (int)Math.Floor(n / 10), u = (int)(n % 10);
        return u == 0 ? TENS[t] : $"{TENS[t]} {N.Connector} {ONES[u]}";
    }

    /** 1 ≤ n < 1000 */
    private static string Below1000(double n)
    {
        if (n == 100) return N.HundredExact;
        int h = (int)Math.Floor(n / 100);
        double r = n % 100;
        var parts = new List<string>();
        if (h != 0) parts.Add(HUNDREDS[h]);
        if (r != 0) parts.Add(Below100(r));
        return string.Join(" ", parts);
    }

    /** `Numbers.Apocope` keyed by the full WORD (`Ones[key]`). ⚠ A key that is not a `Ones` slot throws here,
     *  at load, rather than leaving an entry nothing can ever match. */
    private static readonly IReadOnlyDictionary<string, string> APOCOPE = N.Apocope.ToDictionary(
        kv => int.TryParse(kv.Key, System.Globalization.NumberStyles.None, System.Globalization.CultureInfo.InvariantCulture, out var n)
              && n < ONES.Count
            ? ONES[n]
            : throw new InvalidDataException($"spanish.jsonc numbers.apocope: key \"{kv.Key}\" is not a numbers.ones slot"),
        kv => kv.Value, StringComparer.Ordinal);

    /** A MULTIPLIER, the words before `mil`, a scale noun or a fraction noun, with its last word apocopated.
     *  *Uno* is an adjective there, so 21000 is *veintiún mil*, 101000 *ciento un mil* and 21/5 *veintiún
     *  quintos*. */
    public static string Multiplier(string words)
    {
        int cut = words.LastIndexOf(' ') + 1;
        return APOCOPE.TryGetValue(words[cut..], out var shortForm) ? words[..cut] + shortForm : words;
    }

    /** 1 ≤ n < 10⁶ */
    private static string Below1e6(double n)
    {
        if (n < 1000) return Below1000(n);
        double th = Math.Floor(n / 1000), r = n % 1000;
        var thousand = th == 1 ? N.Thousand : $"{Multiplier(Below1000(th))} {N.Thousand}";
        return r != 0 ? $"{thousand} {Below1000(r)}" : thousand;
    }

    /** Non-negative integer → Spanish words. Out-of-range / unsafe values read digit-by-digit (never empty). */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e18)
            return string.Join(" ", (raw ?? Js.NumberToString(Math.Abs(n)))
                .Select(d => d >= '0' && d <= '9' ? ONES[d - '0'] : d.ToString()));
        if (n == 0) return ONES[0];
        if (n < 1e6) return Below1e6(n);
        foreach (var sc in N.Scales)
        {
            if (n < sc.Value) continue;
            double q = Math.Floor(n / sc.Value), r = n % sc.Value;
            var head = q == 1 ? sc.One : $"{Multiplier(Below1e6(q))} {sc.Many}";
            return r != 0 ? $"{head} {NumberToWords(r)}" : head;
        }
        return Below1e6(n); // unreachable (n ≥ 1e6 matched a scale)
    }
}

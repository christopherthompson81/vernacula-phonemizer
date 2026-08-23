/**
 * English number → spoken words (short scale). Clean reimplementation: digit input becomes the same WORDS
 * a person would type, which then resolve through the lexicon like any other word — so 42 == "forty two"
 * with no fragment-table indirection. Covers 0 … nonillion (bigint). Cardinal + ordinal.
 */
using System.Numerics;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.English;

public static class Numbers
{
    // Number words are authored DATA — consolidated in english.jsonc; the composition logic below is the algorithm.
    private static IReadOnlyList<string> ONES => Manifest.MANIFEST.Numbers.Ones;
    private static IReadOnlyList<string> TENS => Manifest.MANIFEST.Numbers.Tens;
    private static string HUNDRED => Manifest.MANIFEST.Numbers.Hundred;
    private static IReadOnlyList<string> SCALE => Manifest.MANIFEST.Numbers.Scale;
    private static IReadOnlyDictionary<string, string> ORDINAL => Manifest.MANIFEST.Numbers.Ordinals;

    // scale is ascending (thousand=10³ … nonillion=10³⁰); GROUPS is descending {value, name} for the greedy loop.
    private static readonly IReadOnlyList<(BigInteger Value, string Name)> GROUPS =
        SCALE.Select((name, i) => (BigInteger.Pow(10, 3 * (i + 1)), name)).Reverse().ToList();

    private static readonly BigInteger MAX = BigInteger.Pow(10, 3 * (SCALE.Count + 1)) - 1; // nonillion → up to <10³³

    /** cardinal words for 0 ≤ n < 1000. */
    private static List<string> Below1000(int n)
    {
        var outp = new List<string>();
        if (n >= 100)
        {
            outp.Add(ONES[n / 100]);
            outp.Add(HUNDRED);
            n %= 100;
        }
        if (n >= 20)
        {
            outp.Add(TENS[n / 10]);
            if (n % 10 != 0) outp.Add(ONES[n % 10]);
        }
        else if (n > 0) outp.Add(ONES[n]);
        return outp;
    }

    /** Cardinal number → words. `1234` → ["one","thousand","two","hundred","thirty","four"]. */
    public static List<string> NumberToWords(BigInteger n)
    {
        if (n < 0 || n > MAX) return new List<string> { n.ToString(System.Globalization.CultureInfo.InvariantCulture) };
        if (n == 0) return new List<string> { "zero" };
        var outp = new List<string>();
        foreach (var g in GROUPS)
        {
            if (n >= g.Value)
            {
                outp.AddRange(Below1000((int)(n / g.Value)));
                outp.Add(g.Name);
                n %= g.Value;
            }
        }
        if (n > 0) outp.AddRange(Below1000((int)n));
        return outp;
    }

    /** Ordinal number → words (English marks only the LAST word: `21` → ["twenty","first"]). */
    public static List<string> OrdinalToWords(BigInteger n)
    {
        var words = NumberToWords(n);
        if (words.Count > 0 && ORDINAL.TryGetValue(words[^1], out var ord))
            words[^1] = ord;
        return words;
    }
}

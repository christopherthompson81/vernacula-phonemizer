/**
 * Hawaiian cardinal number → words — Polynesian decimal, but NOT Western-shaped: the ʻe-prefixed
 * standalone units vs. the bare stems inside a compound, the kana- tens, and the additive connective
 * kūmā fused into ONE word; the powers of ten are English loans taking the multiplier hoʻokahi for 1.
 * Ported from src/languages/hawaiian/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hawaiian;

public sealed class HawMagnitudes
{
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
    public string Billion { get; init; } = "";
}

public sealed class HawNumbers
{
    public string Zero { get; init; } = "";
    public IReadOnlyList<string> Units { get; init; } = Array.Empty<string>(); // 1..9 standalone (ʻe-prefixed); index 0 unused
    public IReadOnlyList<string> Stems { get; init; } = Array.Empty<string>(); // 1..9 bare stems inside kūmā/kana- compounds
    public string Ten { get; init; } = "";
    public string Twenty { get; init; } = "";
    public string TensPrefix { get; init; } = ""; // kana- (30..90)
    public string Kuma { get; init; } = ""; // the additive connective kūmā
    public string One { get; init; } = ""; // hoʻokahi — the magnitude multiplier for 1
    public HawMagnitudes Magnitudes { get; init; } = new();
}

public static class Numbers
{
    private static HawNumbers N => Manifest.MANIFEST.Numbers;

    /** 1 ≤ n < 100. Tens + kūmā + stem fuse into one word (iwakāluakūmālima). */
    private static string Below100(double n)
    {
        if (n < 10) return N.Units[(int)n];
        int t = (int)Math.Floor(n / 10), u = (int)(n % 10);
        var tens = t == 1 ? N.Ten : t == 2 ? N.Twenty : N.TensPrefix + N.Stems[t];
        return u == 0 ? tens : tens + N.Kuma + N.Stems[u];
    }

    /** "<multiplier> <magnitude>": hoʻokahi haneli, ʻelua haneli, ʻumikūmālua kaukani. */
    private static string ScaleGroup(double count, string scale) =>
        $"{(count == 1 ? N.One : Below1000(count))} {scale}";

    /** 1 ≤ n < 1000 — the hundred group and the remainder are juxtaposed (no connective). */
    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        double h = Math.Floor(n / 100), r = n % 100;
        var hundred = ScaleGroup(h, N.Magnitudes.Hundred);
        return r != 0 ? $"{hundred} {Below100(r)}" : hundred;
    }

    /** Non-negative integer (< 10¹²) → Hawaiian words; larger / non-finite → digit-by-digit. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e12)
            return string.Join(" ", (raw ?? Js.NumberToString(Math.Abs(n))).Select(d =>
                d == '0' ? N.Zero : d >= '1' && d <= '9' ? N.Units[d - '0'] : d.ToString()));
        if (n == 0) return N.Zero; // ʻole
        if (n < 1000) return Below1000(n);
        foreach (var (bas, scale) in new (double, string)[]
                 {
                     (1e9, N.Magnitudes.Billion),
                     (1e6, N.Magnitudes.Million),
                     (1e3, N.Magnitudes.Thousand),
                 })
        {
            if (n < bas) continue;
            double c = Math.Floor(n / bas), r = n % bas;
            var group = ScaleGroup(c, scale);
            return r != 0 ? $"{group} {NumberToWords(r)}" : group;
        }
        return Below1000(n); // unreachable (n < 1000 handled above)
    }
}

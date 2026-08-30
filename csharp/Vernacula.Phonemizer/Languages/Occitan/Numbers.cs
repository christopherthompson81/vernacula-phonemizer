/**
 * Occitan (Languedocien) cardinal number → words. Emits SPACE-separated words, so each element reads back
 * through the occitan.ts g2p (the orthographic hyphens of ⟨dètz-e-sèt⟩ / ⟨vint-e-un⟩ become spaces).
 * Ported from src/languages/occitan/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Occitan;

public sealed class OccitanScale
{
    public double Value { get; init; }
    public string One { get; init; } = "";
    public string Many { get; init; } = "";
}

public sealed class OccitanNumbers
{
    public IReadOnlyList<string> Ones { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Tens { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Hundreds { get; init; } = Array.Empty<string>();
    public string Thousand { get; init; } = "";
    public string And { get; init; } = "";
    public IReadOnlyList<OccitanScale> Scales { get; init; } = Array.Empty<OccitanScale>();
}

public static class Numbers
{
    private static OccitanNumbers N => OccitanPhonemizer.DEF.Numbers;
    private static IReadOnlyList<string> ONES => N.Ones;
    private static IReadOnlyList<string> TENS => N.Tens;
    private static IReadOnlyList<string> HUNDREDS => N.Hundreds;

    /** 0 ≤ n < 100. The twenties take the ⟨e⟩ connector (vint e un); 30–90 juxtapose (trenta un). */
    private static string Below100(double n)
    {
        if (n < 20) return ONES[(int)n];
        int t = (int)Math.Floor(n / 10), u = (int)(n % 10);
        if (u == 0) return TENS[t];
        return t == 2 ? $"{TENS[t]} {N.And} {ONES[u]}" : $"{TENS[t]} {ONES[u]}";
    }

    /** 1 ≤ n < 1000. cent / dos cents … + the remainder juxtaposed (101 → cent un). */
    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        int h = (int)Math.Floor(n / 100);
        double r = n % 100;
        return r != 0 ? $"{HUNDREDS[h]} {Below100(r)}" : HUNDREDS[h];
    }

    /** 1 ≤ n < 10⁶. mila is invariable and drops its "un" (1000 → mila, 2000 → dos mila). */
    private static string Below1e6(double n)
    {
        if (n < 1000) return Below1000(n);
        double th = Math.Floor(n / 1000), r = n % 1000;
        var thousand = th == 1 ? N.Thousand : $"{Below1000(th)} {N.Thousand}";
        return r != 0 ? $"{thousand} {Below1000(r)}" : thousand;
    }

    /**
     * Non-negative integer → Occitan words. Out-of-range / unsafe values read digit-by-digit (never empty).
     */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e12)
            // ⚠ CODE POINTS, NOT CHARS. The TS spreads the string (`[...raw]`), which yields whole code
            // points; iterating a C# string yields UTF-16 CODE UNITS, so an astral character came back as
            // two LONE SURROGATES with a space between them — malformed UTF-16 in the phoneme stream.
            return string.Join(" ", Js.CodePoints(raw ?? Js.NumberToString(Math.Abs(n))).Select(d =>
                Core.Numbers.DigitWord(ONES, d) ?? d));
        if (n == 0) return ONES[0]; // zèro
        if (n < 1e6) return Below1e6(n);
        foreach (var sc in N.Scales)
        {
            if (n < sc.Value) continue;
            double q = Math.Floor(n / sc.Value), r = n % sc.Value;
            var head = q == 1 ? sc.One : $"{Below1e6(q)} {sc.Many}";
            return r != 0 ? $"{head} {NumberToWords(r)}" : head;
        }
        return Below1e6(n); // unreachable (n ≥ 10⁶ matched a scale)
    }
}

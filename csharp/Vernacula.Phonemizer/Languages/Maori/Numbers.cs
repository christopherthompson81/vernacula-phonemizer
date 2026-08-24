/**
 * Māori cardinal number → words — Polynesian decimal: the unit digit is introduced by the additive
 * particle MĀ, and a magnitude with multiplier 1 takes KOTAHI rather than tahi.
 * Ported from src/languages/maori/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Maori;

public sealed class MiMagnitudes
{
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
    public string Billion { get; init; } = "";
}

public sealed class MiNumbers
{
    public string Zero { get; init; } = "";
    public IReadOnlyList<string> Units { get; init; } = Array.Empty<string>(); // 1..9; index 0 unused (zero is its own field)
    public string Ten { get; init; } = "";
    public string And { get; init; } = ""; // the additive particle mā
    public string One { get; init; } = ""; // kotahi — the multiplier form of "one" before a magnitude
    public MiMagnitudes Magnitudes { get; init; } = new();
}

public static class Numbers
{
    private static MiNumbers N => MaoriPhonemizer.DEF.Numbers;

    /** 1 ≤ n < 100 (rua tekau mā rima). */
    private static string Below100(double n)
    {
        if (n < 10) return N.Units[(int)n];
        int t = (int)Math.Floor(n / 10), u = (int)(n % 10);
        var tens = t == 1 ? N.Ten : $"{N.Units[t]} {N.Ten}";
        return u == 0 ? tens : $"{tens} {N.And} {N.Units[u]}";
    }

    /** "<multiplier> <magnitude>": kotahi rau, rua rau, tekau mā rua mano. */
    private static string ScaleGroup(double count, string scale) =>
        $"{(count == 1 ? N.One : Below1000(count))} {scale}";

    /** Append a remainder to a higher group: a BARE unit digit takes mā, anything else is juxtaposed. */
    private static string Join(string high, double r)
    {
        if (r == 0) return high;
        return r < 10 ? $"{high} {N.And} {N.Units[(int)r]}" : $"{high} {NumberToWords(r)}";
    }

    /** 1 ≤ n < 1000 (kotahi rau tekau mā tahi). */
    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        var h = Math.Floor(n / 100);
        return Join(ScaleGroup(h, N.Magnitudes.Hundred), n % 100);
    }

    /** Non-negative integer (< 10¹²) → Māori words; larger / non-finite → digit-by-digit. */
    public static string NumberToWords(double n)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e12)
            return string.Join(" ", Js.NumberToString(Math.Abs(n)).Select(d =>
                d == '0' ? N.Zero : d >= '1' && d <= '9' && d - '0' < N.Units.Count ? N.Units[d - '0'] : d.ToString()));
        if (n == 0) return N.Zero; // kore
        if (n < 1000) return Below1000(n);
        foreach (var (bas, scale) in new (double, string)[]
                 {
                     (1e9, N.Magnitudes.Billion),
                     (1e6, N.Magnitudes.Million),
                     (1e3, N.Magnitudes.Thousand),
                 })
        {
            if (n < bas) continue;
            return Join(ScaleGroup(Math.Floor(n / bas), scale), n % bas);
        }
        return Below1000(n); // unreachable (n < 1000 handled above)
    }
}

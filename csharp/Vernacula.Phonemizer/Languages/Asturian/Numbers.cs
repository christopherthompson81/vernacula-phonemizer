/**
 * Asturian cardinal number → words (masculine).
 * Ported from src/languages/asturian/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Asturian;

public sealed class AsturianScale
{
    public double Value { get; init; }
    public string One { get; init; } = "";
    public string Many { get; init; } = "";
}

public sealed class AsturianNumbers
{
    public IReadOnlyList<string> Ones { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Tens { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Twenties { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Hundreds { get; init; } = Array.Empty<string>();
    public string HundredExact { get; init; } = "";
    public string HundredCombining { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string And { get; init; } = "";
    public IReadOnlyList<AsturianScale> Scales { get; init; } = Array.Empty<AsturianScale>();
}

public static class Numbers
{
    private static AsturianNumbers N => AsturianPhonemizer.DEF.Numbers;
    private static IReadOnlyList<string> ONES => N.Ones;
    private static IReadOnlyList<string> TENS => N.Tens;
    private static IReadOnlyList<string> HUNDREDS => N.Hundreds;

    /** 0 ≤ n < 100. The twenties are FUSED single words; 30–90 take the ⟨y⟩ connector (ALLA XII.2.2). */
    private static string Below100(double n)
    {
        if (n < 20) return ONES[(int)n];
        int t = (int)Math.Floor(n / 10), u = (int)(n % 10);
        if (u == 0) return TENS[t];
        return t == 2 ? N.Twenties[u] : $"{TENS[t]} {N.And} {ONES[u]}";
    }

    /** 1 ≤ n < 1000. The cien/cientu alternation: bare 100 → cien, 101–199 → cientu + remainder. */
    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        int h = (int)Math.Floor(n / 100);
        double r = n % 100;
        var head = h == 1 ? (r != 0 ? N.HundredCombining : N.HundredExact) : HUNDREDS[h];
        return r != 0 ? $"{head} {Below100(r)}" : head;
    }

    /** 1 ≤ n < 10⁶. mil is invariable and drops its "un" (mil, dos mil, cien mil). */
    private static string Below1e6(double n)
    {
        if (n < 1000) return Below1000(n);
        double th = Math.Floor(n / 1000), r = n % 1000;
        var thousand = th == 1 ? N.Thousand : $"{Below1000(th)} {N.Thousand}";
        return r != 0 ? $"{thousand} {Below1000(r)}" : thousand;
    }

    /**
     * Non-negative integer → Asturian words. Out-of-range / unsafe values read digit-by-digit (never empty).
     */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e12)
            // ⚠ CODE POINTS, NOT CHARS. The TS spreads the string (`[...raw]`), which yields whole code
            // points; iterating a C# string yields UTF-16 CODE UNITS, so an astral character came back as
            // two LONE SURROGATES with a space between them — malformed UTF-16 in the phoneme stream.
            return string.Join(" ", Js.CodePoints(raw ?? Js.NumberToString(Math.Abs(n))).Select(d =>
                Core.Numbers.DigitWord(ONES, d) ?? d));
        if (n == 0) return ONES[0]; // cero
        if (n < 1e6) return Below1e6(n);
        foreach (var sc in N.Scales)
        {
            if (n < sc.Value) continue;
            double q = Math.Floor(n / sc.Value), r = n % sc.Value;
            var head = q == 1 ? sc.One : $"{Below1e6(q)} {sc.Many}";
            return r != 0 ? $"{head} {NumberToWords(r)}" : head;
        }
        return Below1e6(n); // unreachable (n ≥ 10⁶ matched the scale)
    }
}

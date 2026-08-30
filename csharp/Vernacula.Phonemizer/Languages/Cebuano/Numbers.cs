/**
 * Cebuano cardinal number → words.
 * Ported from src/languages/cebuano/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Cebuano;

public sealed class CebNumbers
{
    public IReadOnlyList<string> Units { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Tens { get; init; } = Array.Empty<string>();
    public string Connector { get; init; } = "";
    public string Ligature { get; init; } = "";
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
}

public static class Numbers
{
    private static CebNumbers N => CebuanoPhonemizer.DEF.Numbers;

    /** 1 ≤ n < 100 (tens-first: kaluhaan ug usa). */
    private static string Below100(double n)
    {
        if (n < 10) return N.Units[(int)n];
        int t = (int)Math.Floor(n / 10), u = (int)(n % 10);
        return u == 0 ? N.Tens[t] : $"{N.Tens[t]} {N.Connector} {N.Units[u]}";
    }

    /** A "X ka <scale>" group: usa ka gatos, duha ka libo. */
    private static string KaGroup(double count, string scale) =>
        $"{(count == 1 ? N.Units[1] : Below1000(count))} {N.Ligature} {scale}";

    /** 1 ≤ n < 1000. */
    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        double h = Math.Floor(n / 100), r = n % 100;
        var hundred = KaGroup(h, N.Hundred);
        return r != 0 ? $"{hundred} {N.Connector} {Below100(r)}" : hundred;
    }

    /** Non-negative integer (< 10⁹) → Cebuano words; larger / non-finite → digit-by-digit. Chains the libo (10³)
     *  and milyon (10⁶) scales with the "ug" connector. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e9)
            // ⚠ CODE POINTS, NOT CHARS. The TS spreads the string (`[...raw]`), which yields whole code
            // points; iterating a C# string yields UTF-16 CODE UNITS, so an astral character came back as
            // two LONE SURROGATES with a space between them — malformed UTF-16 in the phoneme stream.
            return string.Join(" ", Js.CodePoints(raw ?? Js.NumberToString(Math.Abs(n))).Select(d =>
                Core.Numbers.DigitWord(N.Units, d) ?? d));
        if (n == 0) return N.Units[0]; // sero
        if (n < 1000) return Below1000(n);
        if (n < 1e6)
        {
            double th = Math.Floor(n / 1000), r1 = n % 1000;
            var thousand = KaGroup(th, N.Thousand);
            return r1 != 0 ? $"{thousand} {N.Connector} {Below1000(r1)}" : thousand;
        }
        double mil = Math.Floor(n / 1e6), r = n % 1e6;
        var million = KaGroup(mil, N.Million); // usa ka milyon, duha ka milyon, …
        return r != 0 ? $"{million} {N.Connector} {NumberToWords(r)}" : million;
    }
}

/**
 * Ilocano cardinal number → words. NATIVE Austronesian set, composed MORPHOLOGICALLY (sanga- prefix for a
 * multiplier of 1, fusion for a vowel-final digit, the "a" ligature for a consonant-final one, "ket" between
 * the places) rather than from an irregular tens table.
 * Ported from src/languages/ilocano/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Ilocano;

public sealed class IloMagnitudes
{
    public string Ten { get; init; } = "";
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
}

public sealed class IloNumbers
{
    public IReadOnlyList<string> Units { get; init; } = Array.Empty<string>();
    public string OnePrefix { get; init; } = "";
    public string Ligature { get; init; } = "";
    public string Connector { get; init; } = "";
    public IloMagnitudes Magnitudes { get; init; } = new();
}

public static class Numbers
{
    private static IloNumbers N => IlocanoPhonemizer.DEF.Numbers;

    private static bool IsVowelFinal(string w) => w.Length > 0 && "aeiou".Contains(w[^1].ToString(), StringComparison.Ordinal);

    /** "<multiplier> <magnitude>": sanga- for 1, fused for a vowel-final digit, else the "a" ligature. */
    private static string ScaleGroup(double count, string scale)
    {
        if (count == 1) return $"{N.OnePrefix}{scale}"; // sangapulo, sangagasut, sangaribo, sangariwriw
        var c = count < 10 ? N.Units[(int)count] : Below1000(count);
        return count < 10 && IsVowelFinal(c) ? $"{c}{scale}" : $"{c} {N.Ligature} {scale}";
    }

    /** 1 ≤ n < 100 (duapulo ket maysa). */
    private static string Below100(double n)
    {
        if (n < 10) return N.Units[(int)n];
        int t = (int)Math.Floor(n / 10), u = (int)(n % 10);
        var tens = ScaleGroup(t, N.Magnitudes.Ten);
        return u == 0 ? tens : $"{tens} {N.Connector} {N.Units[u]}";
    }

    /** 1 ≤ n < 1000 (sangagasut ket duapulo ket maysa). */
    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        double h = Math.Floor(n / 100), r = n % 100;
        var hundred = ScaleGroup(h, N.Magnitudes.Hundred);
        return r != 0 ? $"{hundred} {N.Connector} {Below100(r)}" : hundred;
    }

    /** Non-negative integer (< 10⁹) → Ilocano words; larger / non-finite → digit-by-digit. Chains the ribo (10³)
     *  and riwriw (10⁶) scales with the "ket" conjunction. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e9)
            // ⚠ CODE POINTS, NOT CHARS — the TS spreads the string (`[...raw]`), which yields whole code
            // points; iterating a C# string would yield UTF-16 code units and split an astral character
            // into two lone surrogates. Same finding as haw, gn and hil.
            return string.Join(" ", Js.CodePoints(raw ?? Js.NumberToString(Math.Abs(n)))
                .Select(d => Core.Numbers.DigitWord(N.Units, d) ?? d));
        if (n == 0) return N.Units[0]; // sero
        if (n < 1000) return Below1000(n);
        if (n < 1e6)
        {
            double th = Math.Floor(n / 1000), r1 = n % 1000;
            var thousand = ScaleGroup(th, N.Magnitudes.Thousand);
            return r1 != 0 ? $"{thousand} {N.Connector} {Below1000(r1)}" : thousand;
        }
        double mil = Math.Floor(n / 1e6), r = n % 1e6;
        var million = ScaleGroup(mil, N.Magnitudes.Million); // sangariwriw, duariwriw, …
        return r != 0 ? $"{million} {N.Connector} {NumberToWords(r)}" : million;
    }
}

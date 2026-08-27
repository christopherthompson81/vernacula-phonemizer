/**
 * UNITS-FIRST Germanic number composition (the einundzwanzig shape) — the composer body shared by Danish,
 * Faroese, Luxembourgish and Bavarian; only Danish is ported so far.
 * Ported from src/languages/danish/unitsFirstNumbers.ts — see that file for the corpus evidence and for the
 * note that nothing in it is Danish-specific.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Danish;

public sealed class UnitsFirstDef
{
    /** 0..19 spellings — the standalone / citation forms (index 0 = "zero"). */
    public required IReadOnlyList<string> Ones { get; init; }

    /** Round tens indexed by the TENS DIGIT: index 2 = 20 … index 9 = 90 (indices 0–1 unused). */
    public required IReadOnlyList<string> Tens { get; init; }

    /** Unit forms as they appear INSIDE a tens compound, indexed 1..9; omit to reuse `Ones`. Individual
     *  holes fall back to `Ones` too. */
    public IReadOnlyList<string>? CompoundOnes { get; init; }

    /** The unit→tens linker, as a function of the two words it sits between. */
    public required Func<string, string, string> Connector { get; init; }

    /** 10² — `One` is the spelling of a bare 100, `Word` the one that follows a multiplier. */
    public required DanishOneWord Hundred { get; init; }

    /** 10³ — same shape as `Hundred`. */
    public required DanishOneWord Thousand { get; init; }

    /** 10⁶ — `One` is the spelling of a bare million, `Plural` follows a multiplier. */
    public required DanishOnePlural Million { get; init; }

    /** 10⁹ (short scale: milliard). */
    public required DanishOnePlural Billion { get; init; }

    /** Between a multiplier and its hundred/thousand word. */
    public required string MulJoin { get; init; }

    /** Between a hundreds word and its &lt;100 remainder. */
    public required string HundredRemJoin { get; init; }

    /** Between whole magnitude groups. */
    public required string GroupJoin { get; init; }
}

public static class UnitsFirstNumbers
{
    // JS `d.compoundOnes?.[u] ?? d.ones[u]` — an absent ENTRY (a hole) falls back too, not just an absent array.
    private static string CompoundOne(UnitsFirstDef d, int u) =>
        d.CompoundOnes is not null && u < d.CompoundOnes.Count && d.CompoundOnes[u] is not null
            ? d.CompoundOnes[u]
            : d.Ones[u];

    /** 1 ≤ n &lt; 100, units-first and fused into one word above 20 (enogtyve). */
    private static string Below100(int n, UnitsFirstDef d)
    {
        if (n < 20) return d.Ones[n];
        var t = n / 10;
        var u = n % 10;
        var tensWord = d.Tens[t];
        if (u == 0) return tensWord;
        var unit = CompoundOne(d, u);
        return $"{unit}{d.Connector(unit, tensWord)}{tensWord}";
    }

    /** 1 ≤ n &lt; 1000 (fem hundrede og femoghalvfjerds). */
    private static string Below1000(int n, UnitsFirstDef d)
    {
        if (n < 100) return Below100(n, d);
        var h = n / 100;
        var r = n % 100;
        var hundred = h == 1 ? d.Hundred.One : $"{d.Ones[h]}{d.MulJoin}{d.Hundred.Word}";
        return r != 0 ? $"{hundred}{d.HundredRemJoin}{Below100(r, d)}" : hundred;
    }

    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    /** Non-negative integer (&lt; 10¹²) → number words, largest magnitude first; larger / non-finite →
     *  digit-by-digit. */
    public static string UnitsFirstNumberToWords(double n, UnitsFirstDef d, string? raw = null)
    {
        if (!IsSafeInteger(n) || n < 0 || n >= 1e12)
            return string.Join(" ", Js.CodePoints(raw ?? Js.NumberToString(Math.Abs(n)))
                .Select(c =>
                {
                    // JS `d.ones[Number(c)] ?? c`: a non-digit gives NaN and indexes nothing.
                    var idx = Js.Number(c);
                    return double.IsInteger(idx) && idx >= 0 && idx < d.Ones.Count ? d.Ones[(int)idx] : c;
                }));
        if (n == 0) return d.Ones[0];
        var parts = new List<string>();
        var bil = (int)Math.Floor(n / 1e9);
        var mil = (int)Math.Floor(n % 1e9 / 1e6);
        var th = (int)Math.Floor(n % 1e6 / 1000);
        var r = (int)(n % 1000);
        if (bil != 0) parts.Add(bil == 1 ? d.Billion.One : $"{Below1000(bil, d)} {d.Billion.Plural}");
        if (mil != 0) parts.Add(mil == 1 ? d.Million.One : $"{Below1000(mil, d)} {d.Million.Plural}");
        if (th != 0) parts.Add(th == 1 ? d.Thousand.One : $"{Below1000(th, d)}{d.MulJoin}{d.Thousand.Word}");
        if (r != 0) parts.Add(Below1000(r, d));
        return string.Join(d.GroupJoin, parts);
    }
}

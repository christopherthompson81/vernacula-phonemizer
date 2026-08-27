/**
 * Haitian Creole cardinal number → words (IPN orthography), space-separated so each element reads through
 * the haitian.ts g2p. Covers 0 … <10¹²; larger / unsafe values read digit-by-digit.
 * Ported from src/languages/haitian/numbers.ts — see that file for the vigesimal residue and the sourcing.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Haitian;

public sealed class HaitianNumbersDef
{
    public HaitianNumbers Numbers { get; init; } = new();
}

public sealed class HaitianNumbers
{
    public IReadOnlyList<string> Ones { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Teens { get; init; } = Array.Empty<string>();
    public IReadOnlyList<HaitianDecade> Decades { get; init; } = Array.Empty<HaitianDecade>();
    public string One { get; init; } = "";
    public string SixtyTen { get; init; } = "";
    public string FourScore { get; init; } = "";
    public string FourScoreOne { get; init; } = "";
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public HaitianScale Million { get; init; } = new();
    public HaitianScale Billion { get; init; } = new();
    public string TenElided { get; init; } = "";
}

public sealed class HaitianDecade
{
    public string Bare { get; init; } = "";
    public string T { get; init; } = "";
    public string Nn { get; init; } = "";
}

public sealed class HaitianScale
{
    public string One { get; init; } = "";
    public string Word { get; init; } = "";
}

public static class Numbers
{
    // Loaded independently of Haitian.cs's own manifest read, mirroring the TS module split.
    public static readonly HaitianNumbers N =
        LoadManifest.Load<HaitianNumbersDef>("languages/haitian", "haitian.jsonc").Numbers;

    private static IReadOnlyList<string> ONES => N.Ones;
    private static IReadOnlyList<string> TEENS => N.Teens;

    /** 20 ≤ n < 70 — a true decade plus the ⟨bare⟩/⟨t⟩/⟨nn⟩ stem alternation. */
    private static string Decade(int n)
    {
        var d = N.Decades[(int)Math.Floor(n / 10.0) - 2];
        var u = n % 10;
        if (u == 0) return d.Bare;
        if (u == 1) return $"{d.T}{N.One}";
        if (u >= 8) return $"{d.T}{ONES[u]}";
        return $"{d.Nn}{ONES[u]}";
    }

    /** 0 ≤ n < 100. 70–99 are the VIGESIMAL band: 60+teen, and 4×20 (+unit / +teen). */
    private static string Below100(int n)
    {
        if (n < 10) return ONES[n];
        if (n < 20) return TEENS[n - 10];
        if (n < 70) return Decade(n);
        if (n < 80) return $"{N.SixtyTen}{TEENS[n - 70]}";
        if (n == 81) return N.FourScoreOne;
        if (n < 90) return n == 80 ? N.FourScore : $"{N.FourScore}{ONES[n - 80]}";
        return $"{N.FourScore}{TEENS[n - 90]}";
    }

    /** 1 ≤ n < 1000. ⟨san⟩ takes a plain multiplier and no connector (200 de san, 101 san en). */
    private static string Below1000(int n)
    {
        if (n < 100) return Below100(n);
        int h = (int)Math.Floor(n / 100.0), r = n % 100;
        var head = h == 1 ? N.Hundred : $"{ONES[h]} {N.Hundred}";
        return r != 0 ? $"{head} {Below100(r)}" : head;
    }

    /** ⟨dis⟩ (10) elides its ⟨s⟩ before a magnitude noun — LSP "di mil", "di milyon". */
    private static string ElideTen(string words) => words == TEENS[0] ? N.TenElided : words;

    /** 1 ≤ n < 10⁶. ⟨mil⟩ is invariable and drops its "en". */
    private static string Below1e6(double n)
    {
        if (n < 1000) return Below1000((int)n);
        double th = Math.Floor(n / 1000), r = n % 1000;
        var thousand = th == 1 ? N.Thousand : $"{ElideTen(Below1000((int)th))} {N.Thousand}";
        return r != 0 ? $"{thousand} {Below1000((int)r)}" : thousand;
    }

    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    /** Non-negative integer → Haitian Creole words. Out-of-range / unsafe values read digit-by-digit. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!IsSafeInteger(n) || n < 0 || n >= 1e12)
            return string.Join(" ", Js.CodePoints(raw ?? Js.NumberToString(Math.Abs(n)))
                .Select(d =>
                {
                    var idx = Js.Number(d);
                    // JS `ONES[Number(d)] ?? d`: a non-digit gives NaN and indexes nothing.
                    return double.IsInteger(idx) && idx >= 0 && idx < ONES.Count ? ONES[(int)idx] : d;
                }));
        if (n == 0) return ONES[0];
        if (n < 1e6) return Below1e6(n);
        // ⟨milyon⟩ / ⟨milya⟩ are NOUNS and keep their "en" (en milyon, en milya) — unlike the bare ⟨mil⟩.
        var value = n < 1e9 ? 1e6 : 1e9;
        var sc = n < 1e9 ? N.Million : N.Billion;
        double q = Math.Floor(n / value), r = n % value;
        var head = q == 1 ? sc.One : $"{ElideTen(Below1e6(q))} {sc.Word}";
        return r != 0 ? $"{head} {NumberToWords(r)}" : head;
    }
}

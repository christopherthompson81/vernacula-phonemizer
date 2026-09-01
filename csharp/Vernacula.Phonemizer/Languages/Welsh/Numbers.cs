/**
 * Welsh number → words — the modern DECIMAL system (un deg un, dau ddeg pump), with the uncontroversial
 * core of soft/aspirate mutation and the feminine forms required by mil.
 *
 * Ported from src/languages/welsh/numbers.ts — see that file for the attestation behind every base word.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Welsh;

public static class Numbers
{
    private static IReadOnlyList<string> ONES => Manifest.MANIFEST.Numbers.Ones;

    /** Clipped counting forms used BEFORE a noun (deg, cant, mil): pump → pum, chwech → chwe. */
    private static readonly IReadOnlyDictionary<string, string> CLIP = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["pump"] = "pum", ["chwech"] = "chwe",
    };

    /** Feminine forms, required by mil: dau → dwy, tri → tair, pedwar → pedair. */
    private static readonly IReadOnlyDictionary<string, string> FEM = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["dau"] = "dwy", ["tri"] = "tair", ["pedwar"] = "pedair",
    };

    private static string Soft(string w) => w switch { "deg" => "ddeg", "cant" => "gant", "mil" => "fil", _ => w };
    private static string Aspirate(string w) => w == "cant" ? "chant" : w;

    /** JS `Number.isSafeInteger` — the fleet spells this out per language. */
    internal static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    /** unit (2–9, clipped) + mutated noun, honouring gender: (3, "mil") → "tair mil"; (2, "cant") → "dau gant". */
    private static string Counted(double u, string noun)
    {
        var w = CLIP.TryGetValue(ONES[(int)u], out var clip) ? clip : ONES[(int)u];
        if (noun == "mil" && FEM.TryGetValue(w, out var fem)) w = fem;
        if (w == "dau" || w == "dwy") return $"{w} {Soft(noun)}";
        if (w == "tri" || w == "tair" || w == "chwe") return $"{w} {Aspirate(noun)}";
        return $"{w} {noun}";
    }

    /** 1 ≤ n < 100, decimal style: 11 → "un deg un", 25 → "dau ddeg pump". */
    private static string Below100(double n)
    {
        if (n <= 10) return ONES[(int)n];
        var t = Math.Floor(n / 10);
        var u = n % 10;
        var tens = t == 1 ? "un deg" : Counted(t, "deg");
        return u == 0 ? tens : $"{tens} {ONES[(int)u]}";
    }

    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        var h = Math.Floor(n / 100);
        var r = n % 100;
        var head = h == 1 ? "cant" : Counted(h, "cant");
        return r == 0 ? head : $"{head} {Below100(r)}";
    }

    /** Non-negative integer → Welsh words; out of range → digit-by-digit (digits only). */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!IsSafeInteger(n) || n < 0 || n >= 1e9)
            return string.Join(" ", Js.CodePoints(raw ?? Js.NumberToString(Math.Abs(n)))
                .Where(c => string.CompareOrdinal(c, "0") >= 0 && string.CompareOrdinal(c, "9") <= 0)
                .Select(d => ONES[d[0] - '0']));
        if (n == 0) return ONES[0]; // dim
        if (n < 1000) return Below1000(n);
        if (n < 1e6)
        {
            var th = Math.Floor(n / 1000);
            var r = n % 1000;
            var head = th == 1 ? "mil" : th <= 9 ? Counted(th, "mil") : $"{Below1000(th)} mil";
            return r == 0 ? head : $"{head} {Below1000(r)}";
        }
        var m = Math.Floor(n / 1e6);
        var r2 = n % 1e6;
        var head2 = m == 1 ? "miliwn" : $"{Below1000(m)} miliwn";
        return r2 == 0 ? head2 : $"{head2} {NumberToWords(r2)}";
    }
}

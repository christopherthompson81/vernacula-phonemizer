/**
 * Zulu (zu) cardinal number compositor — agglutinative Bantu: ku-/na-/ama- unit stems and noun-class
 * magnitudes, composed into Zulu TEXT which the word engine then reads.
 * Ported from src/languages/zulu/numbers.ts — see that file for the evidence.
 */
namespace Vernacula.Phonemizer.Languages.Zulu;

public static class Numbers
{
    private static ZuluNumbersDef N => Manifest.MANIFEST.Numbers;

    /** A JS array index that overflows yields `undefined`, not an exception — the TS relies on it
     *  (`AMA[th] ?? numberToWords(th)`), so the overflow has to read as null here too. */
    private static string? At(IReadOnlyList<string> a, double i) =>
        i >= 0 && i < a.Count && i == Math.Floor(i) ? a[(int)i] : null;

    /** A non-negative integer → space-separated Zulu cardinal words. */
    public static string NumberToWords(double n)
    {
        if (n < 0 || double.IsNaN(n) || double.IsInfinity(n)) return "";
        n = Math.Floor(n);
        if (n == 0) return N.Zero;
        var ku = N.Ku;
        var na = N.Na;
        var ama = N.Ama;
        if (n >= 1000000)
        {
            var m = Math.Floor(n / 1000000);
            var rem = n % 1000000;
            var mil = m == 1 ? N.Million.One : $"{N.Million.Many} {At(ama, m) ?? NumberToWords(m)}";
            return rem != 0 ? $"{mil} {NumberToWords(rem)}" : mil;
        }
        var parts = new List<string>();
        var th = Math.Floor(n / 1000);
        var h = Math.Floor(n % 1000 / 100);
        var t = Math.Floor(n % 100 / 10);
        var u = n % 10;
        if (th == 1) parts.Add(N.Thousand.One);
        else if (th >= 2) { parts.Add(N.Thousand.Many); parts.Add(At(ama, th) ?? NumberToWords(th)); }
        if (h == 1) parts.Add(N.Hundred.One);
        else if (h >= 2) { parts.Add(N.Hundred.Many); parts.Add(At(ama, h)!); }
        if (t == 1) parts.Add(N.Ten.One);
        else if (t >= 2) { parts.Add(N.Ten.Many); parts.Add(At(ama, t)!); }
        if (u > 0) parts.Add(parts.Count == 0 ? At(ku, u)! : At(na, u)!); // standalone ku- alone, else connective na-
        return string.Join(" ", parts);
    }
}

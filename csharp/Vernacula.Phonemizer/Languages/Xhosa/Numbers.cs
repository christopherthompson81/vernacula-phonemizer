/**
 * Xhosa (xh) cardinal number compositor — agglutinative Nguni, the same algorithm as Zulu over the Xhosa
 * number words, composed into Xhosa TEXT which the word engine then reads.
 * Ported from src/languages/xhosa/numbers.ts — see that file for the evidence, and for why the digit-at-a-time
 * fallback above 2^53 is this language's own reading rather than an invention.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Zulu;

namespace Vernacula.Phonemizer.Languages.Xhosa;

public static class Numbers
{
    private static ZuluNumbersDef N => Manifest.MANIFEST.Numbers;

    /** `Number.isSafeInteger` — the local idiom the fleet uses; there is no BCL equivalent. */
    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    /** A JS array index that overflows yields `undefined`, not an exception — the TS relies on it
     *  (`AMA[th] ?? numberToWords(th)`), so the overflow has to read as null here too. */
    private static string? At(IReadOnlyList<string> a, double i) =>
        i >= 0 && i < a.Count && i == Math.Floor(i) ? a[(int)i] : null;

    /** Read a digit STRING one digit at a time, in the standalone counting stems. ⚠ `Ku[0]` is the EMPTY
     *  STRING, so the zero word comes from the manifest directly — not from the table. */
    private static string ReadDigits(string digits) =>
        string.Join(" ", Js.CodePoints(digits).Select(d =>
            d == "0" ? N.Zero : (d.Length == 1 && d[0] >= '0' && d[0] <= '9' ? N.Ku[d[0] - '0'] : d)));

    /** A non-negative integer → space-separated Xhosa cardinal words. `raw` is the caller's separator-stripped
     *  TOKEN STRING, read digit-at-a-time above 2^53 where the double no longer carries the digits (#1059). */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (n < 0 || double.IsNaN(n) || double.IsInfinity(n)) return "";
        n = Math.Floor(n);
        if (n == 0) return N.Zero;
        if (!IsSafeInteger(n)) return ReadDigits(raw ?? Js.NumberToString(n));
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

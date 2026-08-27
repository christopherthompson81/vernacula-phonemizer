/**
 * Finnish cardinal number compositor. Finnish AGGLUTINATES: everything below 1000 is ONE concatenated word,
 * the ⟨tuhat⟩ magnitude joins and ⟨miljoona⟩ stays separate, and a count before a magnitude takes the
 * partitive stem.
 * Ported from src/languages/finnish/numbers.ts.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Finnish;

public static class Numbers
{
    private static FinnishNumbers N => Manifest.MANIFEST.Numbers;

    /** `Number.isSafeInteger` — the local idiom the fleet uses; there is no BCL equivalent. */
    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    /** 1–99 as one concatenated Finnish word (never called with 0). */
    private static string Below100(double n)
    {
        if (n < 10) return N.Units[(int)n];
        if (n == 10) return N.Ten;
        if (n < 20) return N.Units[(int)n - 10] + N.TeenSuffix; // 11–19: unit + "toista"
        var t = (int)Math.Floor(n / 10);
        var o = (int)(n % 10);
        return N.Units[t] + N.TensStem + (o != 0 ? N.Units[o] : ""); // 20–99: unit + "kymmentä" [+ ones]
    }

    /** 1–999 as one concatenated Finnish word. */
    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        var h = (int)Math.Floor(n / 100);
        var r = n % 100;
        var hundred = h == 1 ? N.Hundred : N.Units[h] + N.HundredStem; // 100=sata, 200=kaksisataa
        return hundred + (r != 0 ? Below100(r) : "");
    }

    /** Read a raw digit STRING digit-by-digit — the fallback for an out-of-range or over-long number.
     *  Operates on the STRING so no precision is lost and an exponential `String(Number)` cannot leak `e`/`+`. */
    public static string ReadDigits(string digits) =>
        string.Join(" ", Js.CodePoints(digits).Select(d =>
        {
            var v = Js.Number(d);
            if (v == 0) return N.Zero;
            // JS `N.units[Number(d)] ?? d` — a non-digit indexes with NaN and falls through to the character.
            return double.IsInteger(v) && v >= 0 && v < N.Units.Count ? N.Units[(int)v] : d;
        }));

    /** A non-negative integer → its Finnish cardinal reading (space-separated at the tuhat/miljoona joints). */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!IsSafeInteger(n) || n < 0 || n >= 1e9) return ReadDigits(raw ?? Js.NumberToString(n));
        if (n == 0) return N.Zero;
        var parts = new List<string>();
        var mil = Math.Floor(n / 1e6);
        var after = n % 1e6;
        if (mil > 0)
        {
            if (mil == 1) parts.Add(N.Million);
            else { parts.Add(Below1000(mil)); parts.Add(N.MillionStem); } // written separately
        }
        var th = Math.Floor(after / 1000);
        var rem = after % 1000;
        if (th > 0) parts.Add(th == 1 ? N.Thousand : Below1000(th) + N.ThousandStem); // joined
        if (rem > 0) parts.Add(Below1000(rem));
        return string.Join(" ", parts);
    }
}

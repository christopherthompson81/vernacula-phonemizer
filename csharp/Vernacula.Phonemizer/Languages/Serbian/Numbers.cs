/**
 * Serbo-Croatian cardinal number → words. The compositor is parameterized by the number-word table so the
 * Croatian and Bosnian standards can pass their own; only the words differ, the agreement grammar is shared.
 * Ported from src/languages/serbian/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Serbian;

public static class Numbers
{
    // ⚠ ANCHORED AT END-OF-STRING so only the units slot is feminised (dvadeset jedan → dvadeset jedna);
    // jedanaest/dvanaest do not end in "jedan" and are left alone.
    private static readonly JsRe JEDAN_FINAL = JsRegex.Compile("jedan$", "u");
    private static readonly JsRe DVA_FINAL = JsRegex.Compile("dva$", "u");

    /** Compose a Serbo-Croatian cardinal from the given number-word table `N` (Serbian, Croatian or Bosnian). */
    public static string ComposeSlavicNumber(double n, SerbianNumbers N, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991.0) || n < 0 || n >= 1e9)
        {
            var src = raw ?? Js.NumberToString(Math.Abs(n));
            return string.Join(" ", Js.CodePoints(src).Select(d =>
            {
                var i = Js.Number(d);
                return double.IsInteger(i) && i >= 0 && i < N.Units.Count ? N.Units[(int)i] : d;
            }));
        }
        if (n == 0) return N.Units[0]; // nula
        if (n < 1000) return Below1000(n, N);

        var parts = new List<string>();
        double mil = Math.Floor(n / 1e6), th = Math.Floor(n % 1e6 / 1000), r = n % 1000;
        if (mil != 0) parts.Add($"{Below1000(mil, N)} {Agree(mil, N.Million)}");
        if (th != 0)
            parts.Add(th == 1
                ? N.Thousand.Standalone!
                : $"{Feminise(Below1000(th, N), N.Thousand)} {Agree(th, N.Thousand)}");
        if (r != 0) parts.Add(Below1000(r, N));
        return string.Join(" ", parts);
    }

    /** 1 ≤ n < 100. */
    private static string Below100(double n, SerbianNumbers N)
    {
        if (n < 10) return N.Units[(int)n];
        if (n < 20) return N.Teens[(int)n - 10];
        double t = Math.Floor(n / 10), u = n % 10;
        return u == 0 ? N.Tens[(int)t] : $"{N.Tens[(int)t]} {N.Units[(int)u]}";
    }

    /** 1 ≤ n < 1000. */
    private static string Below1000(double n, SerbianNumbers N)
    {
        if (n < 100) return Below100(n, N);
        double h = Math.Floor(n / 100), r = n % 100;
        return r != 0 ? $"{N.Hundreds[(int)h]} {Below100(r, N)}" : N.Hundreds[(int)h];
    }

    /** Slavic count agreement: …1 (not 11) → one, …2–4 (not 12–14) → few, else many. */
    private static string Agree(double count, SlavicMagnitude m)
    {
        double d = count % 10, dd = count % 100;
        if (d == 1 && dd != 11) return m.One;
        if (!string.IsNullOrEmpty(m.Few) && d >= 2 && d <= 4 && !(dd >= 12 && dd <= 14)) return m.Few!;
        return m.Many;
    }

    /** Feminise the multiplier's FINAL word for a feminine magnitude noun (hiljada/tisuća). */
    private static string Feminise(string words, SlavicMagnitude m) =>
        !string.IsNullOrEmpty(m.OneFeminine) && !string.IsNullOrEmpty(m.TwoFeminine)
            ? DVA_FINAL.Replace(JEDAN_FINAL.Replace(words, _ => m.OneFeminine!), _ => m.TwoFeminine!)
            : words;

    /**
     * Non-negative integer (< 10⁹) → Serbian words; larger / non-finite → digit-by-digit.
     * ⚠ `raw` IS THE TOKEN STRING AND THE CALLER MUST PASS IT (#1059) — the digits cannot be recovered from
     * the double.
     */
    public static string NumberToWords(double n, string? raw = null) =>
        ComposeSlavicNumber(n, Manifest.MANIFEST.Numbers, raw);
}

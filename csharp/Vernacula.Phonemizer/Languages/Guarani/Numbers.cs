/**
 * Paraguayan Guaraní (gn) cardinal number → words — the 20th-century Decoud Larrosa neologism system,
 * NOT the Spanish loan numerals that dominate colloquial speech, and a deliberate choice a port must not
 * silently "fix". Transparent and multiplicative: `po` 5, `pa` 10, `sa` 100, `su` 1000, `sua` 10⁶,
 * built by apheresis (teĩ, kõi, 'apy, rundy) with the multiplier ONE dropped at every scale.
 * Ported from src/languages/guarani/numbers.ts, whose header carries the case for this register, the
 * sources (Estigarribia 2020 §3.4.3, Wiktionary gug), and the one place the table goes beyond them.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Guarani;

public static class Numbers
{
    /** Full (free) unit forms 0–10. 0 is `mba'eve` 'nothing'. */
    private static readonly string[] UNITS =
        ["mba'eve", "peteĩ", "mokõi", "mbohapy", "irundy", "po", "poteĩ", "pokõi", "poapy", "porundy", "pa"];

    /** COMBINING (apheresised) unit stems 1–9, used after `pa` to build the teens: pa+teĩ = pateĩ 11. */
    private static readonly string[] COMBINING =
        ["", "teĩ", "kõi", "'apy", "rundy", "po", "poteĩ", "pokõi", "poapy", "porundy"];

    private const string TEN = "pa";          // < opa 'totality'
    private const string HUNDRED = "sa";      // < rasa 'very'
    private const string THOUSAND = "su";     // < guasu 'big'
    private const string MILLION = "sua";     // 10⁶; pa+sua = 10⁷, sa+sua = 10⁸

    /** JS `Number.isSafeInteger` — the local idiom the fleet uses; there is no BCL equivalent. */
    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    /** 0 ≤ n < 100. Teens FUSED (pateĩ), round tens FUSED (mokõipa), 21–99 tens + SPACE + full unit. */
    private static string Below100(int n)
    {
        if (n <= 10) return UNITS[n];
        if (n < 20) return TEN + COMBINING[n - 10];
        var t = n / 10;
        var u = n % 10;
        var tens = UNITS[t] + TEN;
        return u == 0 ? tens : $"{tens} {UNITS[u]}";
    }

    /** 1 ≤ n < 1000. Hundreds FUSED; the multiplier ONE is dropped (100 = sa, not *peteĩsa). */
    private static string Below1000(int n)
    {
        var h = n / 100;
        var r = n % 100;
        if (h == 0) return Below100(n);
        var head = (h == 1 ? "" : UNITS[h]) + HUNDRED;
        return r == 0 ? head : $"{head} {Below100(r)}";
    }

    /** 1 ≤ n < 10⁶. The multiplier fuses to `su`: su 1000 · mokõisu 2000 · pasu 10⁴ · sasu 10⁵. */
    private static string Below1e6(double n)
    {
        var th = (int)Math.Floor(n / 1000);
        var r = (int)(n % 1000);
        if (th == 0) return Below1000((int)n);
        var head = (th == 1 ? "" : Below1000(th)) + THOUSAND;
        return r == 0 ? head : $"{head} {Below1000(r)}";
    }

    /** Read a digit string one digit at a time (the ≥10⁹ / unsafe-integer fallback). */
    public static string ReadDigits(string digits) =>
        string.Join(" ", Js.CodePoints(digits).Select(d => UNITS[(int)Js.Number(d)]));

    /**
     * Non-negative integer → Guaraní cardinal words. ≥10⁹ or non-safe → digit-by-digit.
     *
     * ⚠ THE DIGIT ARM READS `raw` WHEN IT HAS ONE — the token as the text wrote it, not a re-stringified
     * double, because above 2^53 the double is precisely what cannot be trusted.
     */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!IsSafeInteger(n) || n < 0 || n >= 1e9) return ReadDigits(raw ?? Js.NumberToString(n));
        if (n < 1e6) return Below1e6(n);
        var m = (int)Math.Floor(n / 1e6);
        var r = (int)(n % 1e6);
        var head = (m == 1 ? "" : Below1000(m)) + MILLION;
        return r == 0 ? head : $"{head} {Below1e6(r)}";
    }
}

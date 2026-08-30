/**
 * Kabuverdianu cardinal number → words (Santiago / Badiu, ALUPEC). Emits SPACE-separated words so each
 * element reads through the kabuverdianu g2p. Covers 0 … <10¹²; larger / unsafe values read digit-by-digit.
 * Ported from src/languages/kabuverdianu/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kabuverdianu;

public static class Numbers
{
    private static KabuverdianuNumbers N => Manifest.MANIFEST.Numbers;
    private static IReadOnlyList<string> ONES => N.Ones;
    private static IReadOnlyList<string> TEENS => N.Teens;
    private static IReadOnlyList<string> TENS => N.Tens;
    private static IReadOnlyList<string> HUNDREDS => N.Hundreds;

    /** 0 ≤ n < 100. The tens JUXTAPOSE with their unit — no connector (vinti un, trinta dos, sinkuenta sais). */
    private static string Below100(double n)
    {
        if (n < 10) return ONES[(int)n];
        if (n < 20) return TEENS[(int)n - 10];
        int t = (int)Math.Floor(n / 10), u = (int)(n % 10);
        return u == 0 ? TENS[t] : $"{TENS[t]} {ONES[u]}";
    }

    /** 1 ≤ n < 1000. ⟨sen⟩ 100 vs the plural ⟨-sentus⟩ series 200–900; the remainder juxtaposes (101 → sen un). */
    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        int h = (int)Math.Floor(n / 100);
        double r = n % 100;
        return r != 0 ? $"{HUNDREDS[h]} {Below100(r)}" : HUNDREDS[h];
    }

    /** 1 ≤ n < 10⁶. ⟨mil⟩ is invariable and drops its "un" (1000 → mil, 2000 → dos mil). */
    private static string Below1e6(double n)
    {
        if (n < 1000) return Below1000(n);
        double th = Math.Floor(n / 1000), r = n % 1000;
        var thousand = th == 1 ? N.Thousand : $"{Below1000(th)} {N.Thousand}";
        return r != 0 ? $"{thousand} {Below1000(r)}" : thousand;
    }

    /** Non-negative integer → Kabuverdianu words. Out-of-range / unsafe values read digit-by-digit (never empty). */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e12)
            return string.Join(" ", (raw ?? Js.NumberToString(Math.Abs(n)))
                .Select(d => d >= '0' && d <= '9' ? ONES[d - '0'] : d.ToString()));
        if (n == 0) return ONES[0]; // zéru
        if (n < 1e6) return Below1e6(n);
        double m = Math.Floor(n / 1e6), r = n % 1e6;
        // ⟨milion⟩ is a NOUN and keeps its "un" (un milion), unlike the bare ⟨mil⟩. 10⁹ composes as the
        // European-Portuguese-style "mil milion" (mil milhões) — no unattested creole billion lexeme is invented.
        var head = m == 1 ? N.Million.One : $"{Below1e6(m)} {N.Million.Word}";
        return r != 0 ? $"{head} {NumberToWords(r)}" : head;
    }
}

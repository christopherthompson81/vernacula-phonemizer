/**
 * Mooré (Mossi) cardinal number → words. Ported from src/languages/mossi/numbers.ts, whose header
 * carries the sources (desmotsetdeslangues.eklablog.com/moore; Peace Corps/Burkina Faso "Introduction
 * to Mooré" (2006); Lexique français-mooré) and the corpus evidence for the 10⁶/10⁹ loans.
 *
 * DECIMAL, bespoke because of the two Gur features a shared composer cannot express: each unit has
 * a full and a SHORT combining stem (yembre ~ ye, yiibu ~ yi, tãabo ~ tã), and a bare unit inside a
 * compound needs the numeral particle a (piig la a ye 11) while a tens phrase takes la alone. The
 * tens/hundreds/thousands are the noun-class plurals piiga→pisi/pis, koabga→kobs, tusri→tus.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Mossi;

public static class Numbers
{
    /** Citation/full forms 0–10 (0 = zaalem 'nothing'). */
    private static readonly string[] ONES =
        ["zaalem", "yembre", "yiibu", "tãabo", "naase", "nu", "yoobe", "yopoe", "nii", "wɛ", "piiga"];

    /** SHORT combining forms 1–9, used after the particle a and inside the pis-/kobs-/tus- compounds. */
    private static readonly string[] SHORT =
        ["", "ye", "yi", "tã", "naase", "nu", "yoobe", "yopoe", "nii", "wɛ"];

    private const string LA = "la";           // 'and' — the additive coordinator
    private const string A = "a";             // the numeral particle before a bare unit
    private const string TEN = "piiga";
    private const string TEN_COMB = "piig";   // the combining form of piiga in the teens (piig la a ye)
    private const string TWENTY = "pisi";     // the plural of piiga; 30–90 use the bare plural stem pis
    private const string TEN_PL = "pis";
    private const string HUNDRED = "koabga";
    private const string HUNDRED_PL = "kobs";
    private const string THOUSAND = "tusri";
    private const string THOUSAND_PL = "tus";
    // 10⁶ / 10⁹ — the French loans, attested in the filtered corpus with the particle compound.
    // Neither alternates for number, so one stem each.
    private const string MILLION = "milyõ";
    private const string BILLION = "milyaar";

    /** A bare unit as a compound member: the particle a + the SHORT stem. */
    private static string Unit(int u) => $"{A} {SHORT[u]}";

    /** Round tens 10–90. */
    private static string Tens(int t) => t == 1 ? TEN : t == 2 ? TWENTY : $"{TEN_PL} {SHORT[t]}";

    /** 0–99. */
    private static string Below100(double n)
    {
        if (n < 10) return ONES[(int)n];
        int t = (int)Math.Floor(n / 10), u = (int)(n % 10);
        var head = n < 20 ? TEN_COMB : Tens(t); // the teens use the combining piig, not piiga
        return u == 0 ? Tens(t) : $"{head} {LA} {Unit(u)}";
    }

    /** 1–999: koabga (100) / kobs a X (200…), remainder joined with la. */
    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        int h = (int)Math.Floor(n / 100), r = (int)(n % 100);
        var head = h == 1 ? HUNDRED : $"{HUNDRED_PL} {Unit(h)}";
        // a bare unit remainder needs the particle; a tens phrase does not
        return r == 0 ? head : $"{head} {LA} {(r < 10 ? Unit(r) : Below100(r))}";
    }

    /** 1–999,999: tusri (1000) / tus a X (2000…), remainder joined with la. */
    private static string Below1e6(double n)
    {
        if (n < 1000) return Below1000(n);
        int th = (int)Math.Floor(n / 1000), r = (int)(n % 1000);
        var head = th == 1 ? THOUSAND : th < 10 ? $"{THOUSAND_PL} {Unit(th)}" : $"{THOUSAND_PL} {Below1000(th)}";
        return r == 0 ? head : $"{head} {LA} {(r < 10 ? Unit(r) : Below1000(r))}";
    }

    /**
     * A scale word (milyõ 10⁶, milyaar 10⁹) plus its multiplier, then the remainder joined with la.
     *
     * The multiplier takes the particle-plus-SHORT-stem compound below ten (`milyõ a yopoe`) and the
     * bare composed figure at ten and above (`milyõ 37`) — the same split Below1000 already makes for
     * kobs/tus. ⚠ NO SINGULAR FORM: 1 million is `milyõ a ye`, not a bare `milyõ`, which is why this
     * does not take the `th == 1` branch Below1e6 has for tusri.
     */
    private static string Scaled(double n, double scale, string word, Func<double, string> rest)
    {
        int c = (int)Math.Floor(n / scale), r = (int)(n % scale);
        var head = c < 10 ? $"{word} {Unit(c)}" : $"{word} {Below1000(c)}";
        return r == 0 ? head : $"{head} {LA} {(r < 10 ? Unit(r) : rest(r))}";
    }

    /** JS `Number.isSafeInteger(n)`: an integral double inside ±(2^53 − 1). */
    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    /** Non-negative integer → Mooré words; ≥ 10¹² (nothing above milyaar is attested) → digit-by-digit. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!IsSafeInteger(n) || n < 0 || n >= 1e12)
        {
            // ⚠ THE DIGIT ARM READS `raw` WHEN IT HAS ONE — the token as the text wrote it, not a
            // re-stringified double, because above 2^53 the double is precisely what cannot be trusted.
            var src = raw ?? Js.NumberToString(Math.Abs(n));
            return string.Join(" ", Js.CodePoints(src)
                .Where(c => c.Length == 1 && c[0] >= '0' && c[0] <= '9')
                .Select(d => ONES[d[0] - '0']));
        }
        if (n < 1e6) return Below1e6(n);
        if (n < 1e9) return Scaled(n, 1e6, MILLION, Below1e6);
        return Scaled(n, 1e9, BILLION, r => r < 1e6 ? Below1e6(r) : Scaled(r, 1e6, MILLION, Below1e6));
    }
}

/**
 * Papiamentu cardinal number → words. Covers 0 … <10¹²; larger / unsafe values read digit-by-digit.
 * Ported from src/languages/papiamento/numbers.ts — see that file for the Wiktionary/palabricks
 * sourcing and the two composition rules that shape the sub-1000 single word.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Papiamento;

public static class Numbers
{
    private static readonly string[] ONES =
        { "sero", "un", "dos", "tres", "kuater", "sinku", "seis", "shete", "ocho", "nuebe" };
    private static readonly string[] TEENS =
        { "dies", "diesun", "diesdos", "diestres", "dieskuater", "diesinku", "dieseis", "dieshete", "diesocho", "diesnuebe" };
    private static readonly string[] TENS =
        { "", "", "binti", "trinta", "kuarenta", "sinkuenta", "sesenta", "setenta", "ochenta", "nobenta" };
    // The COMBINING stems (final ⟨-a⟩ → ⟨-i⟩), used when a unit follows.
    private static readonly string[] TENS_COMBINING =
        { "", "", "binti", "trinti", "kuarenti", "sinkuenti", "sesenti", "setenti", "ochenti", "nobenti" };
    private static readonly string[] HUNDREDS =
        { "", "shen", "doshen", "treshen", "kuatershen", "sinkushen", "seishen", "sheteshen", "ochoshen", "nuebeshen" };
    private const string HUNDRED_LINK = "ti";
    private const string THOUSAND = "mil";
    private const string MILLION = "mion";
    private const string AND = "i";

    /** 0 ≤ n < 100, as ONE word: the tens stem takes its combining ⟨-i⟩ form before a unit. */
    private static string Below100(double n)
    {
        if (n < 10) return ONES[(int)n];
        if (n < 20) return TEENS[(int)(n - 10)];
        var t = (int)Math.Floor(n / 10);
        var u = (int)(n % 10);
        return u == 0 ? TENS[t] : $"{TENS_COMBINING[t]}{ONES[u]}";
    }

    /** 1 ≤ n < 1000, as ONE word: the hundred joins its remainder through the fused ⟨-ti-⟩ link. */
    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        var h = (int)Math.Floor(n / 100);
        var r = n % 100;
        return r > 0 ? $"{HUNDREDS[h]}{HUNDRED_LINK}{Below100(r)}" : HUNDREDS[h];
    }

    /** 1 ≤ n < 10⁶. ⟨mil⟩ is invariable and drops its "un" (1000 → mil, 2000 → dos mil). */
    private static string Below1e6(double n)
    {
        if (n < 1000) return Below1000(n);
        var th = Math.Floor(n / 1000);
        var r = n % 1000;
        var thousand = th == 1 ? THOUSAND : $"{Below1000(th)} {THOUSAND}";
        // ⟨mil⟩ ends in a consonant so the additive ⟨i⟩ cannot fuse — it stays a separate word (mil i un).
        return r > 0 ? $"{thousand} {AND} {Below1000(r)}" : thousand;
    }

    /** Non-negative integer → Papiamentu words. Out-of-range / unsafe values read digit-by-digit (never empty). */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e12)
        {
            // ⚠ `DigitWord … ?? c` IS the TS `ONES[digitIndex(d)] ?? d`: a non-digit passes through
            // rather than indexing the units table, and the raw token goes along so the arm reads the
            // digits the text wrote rather than a double that above 2^53 has lost its low digits.
            var words = Js.CodePoints(raw ?? Js.NumberToString(Math.Abs(n)))
                .Select(c => Vernacula.Phonemizer.Core.Numbers.DigitWord(ONES, c) ?? c);
            return string.Join(" ", words);
        }
        if (n == 0) return ONES[0];
        if (n < 1e6) return Below1e6(n);
        var m = Math.Floor(n / 1e6);
        var r = n % 1e6;
        // ⟨mion⟩ is a NOUN and keeps its "un" (un mion); 10⁹ composes as "mil mion".
        var head = $"{(m == 1 ? ONES[1] : Below1e6(m))} {MILLION}";
        return r > 0 ? $"{head} {AND} {NumberToWords(r)}" : head;
    }
}

/**
 * Nama / Khoekhoegowab (naq) cardinal number → words: native Khoe decimal for 1–999 999, with the two
 * naturalised loan magnitudes `miljun` (10⁶) and `biljun` (10⁹) that published Khoekhoegowab actually uses.
 * Ported from src/languages/nama/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Nama;

public static class Numbers
{
    // Unit stems 1–10; 10 = disi, the element that also builds the teens and the tens. Index 0 is
    // deliberately NOT a numeral — see ZERO_STOPGAP.
    private static readonly string[] UNITS =
        ["", "ǀgui", "ǀgam", "ǃnona", "haka", "koro", "ǃnani", "hû", "ǁkhaisa", "khoese", "disi"];
    // ⚠ NOT a Khoekhoegowab numeral: an unattested Afrikaans contact-loan stopgap for 0.
    private const string ZERO_STOPGAP = "nul";
    private const string TEN = "disi";
    private const string TEEN_CONNECTOR = "ǀa"; // the 11–19 / 21–99 final element; its gloss is unpublished
    private const string HUNDRED = "kaidisi";
    private const string THOUSAND = "ǀoadisi";
    private const string MILLION = "miljun";
    private const string BILLION = "biljun";

    /** 1 ≤ n < 100, written SOLID as one word (the attested shape). */
    private static string Below100(double n)
    {
        if (n <= 10) return UNITS[(int)n];
        if (n < 20) return TEN + UNITS[(int)n - 10] + TEEN_CONNECTOR; // disiǀguiǀa 11
        var t = Math.Floor(n / 10);
        var u = n % 10;
        if (u == 0) return UNITS[(int)t] + TEN; // ǀgamdisi 20 — multiplier starts at TWO
        return UNITS[(int)t] + TEN + UNITS[(int)u] + TEEN_CONNECTOR; // ǀgamdisiǃnaniǀa 26
    }

    /** 1 ≤ n < 1000. The hundred and its remainder are separate words. */
    private static string Below1000(double n)
    {
        var h = Math.Floor(n / 100);
        var r = n % 100;
        if (h == 0) return Below100(n);
        var head = h == 1 ? HUNDRED : UNITS[(int)h] + HUNDRED;
        return r == 0 ? head : $"{head} {Below100(r)}";
    }

    /** 1 ≤ n < 10⁶. */
    private static string Below1e6(double n)
    {
        var th = Math.Floor(n / 1000);
        var r = n % 1000;
        if (th == 0) return Below1000(n);
        var head = th == 1 ? THOUSAND : $"{Below1000(th)} {THOUSAND}";
        return r == 0 ? head : $"{head} {Below1000(r)}";
    }

    /**
     * Read a digit string one digit at a time — the ≥10¹² / non-safe-integer fallback: the attested units
     * 1–9 plus the `nul` stopgap for 0, never silently dropped.
     */
    public static string ReadDigits(string digits) =>
        string.Join(" ", Js.CodePoints(digits).Select(d => d == "0" ? ZERO_STOPGAP : (Core.Numbers.DigitWord(UNITS, d) ?? d)));

    /**
     * Non-negative integer → Khoekhoegowab cardinal words. 0 yields the flagged Afrikaans stopgap `nul`;
     * ≥10¹² or non-safe falls back to digit-by-digit. Never returns "".
     */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e12)
            return ReadDigits(raw ?? Js.NumberToString(n));
        if (n == 0) return ZERO_STOPGAP;
        if (n < 1e6) return Below1e6(n);
        if (n < 1e9)
        {
            var m = Math.Floor(n / 1e6);
            var r6 = n % 1e6;
            var head6 = m == 1 ? MILLION : $"{Below1000(m)} {MILLION}";
            return r6 == 0 ? head6 : $"{head6} {Below1e6(r6)}";
        }
        var b = Math.Floor(n / 1e9);
        var r = n % 1e9;
        var head = b == 1 ? BILLION : $"{Below1000(b)} {BILLION}";
        return r == 0 ? head : $"{head} {NumberToWords(r)}";
    }
}

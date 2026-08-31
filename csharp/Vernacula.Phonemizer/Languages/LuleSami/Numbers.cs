/**
 * Lule Sami (smj) cardinal number → words. **SYSTEM: NATIVE Uralic DECIMAL** — no borrowed numeral series
 * below 10⁶ (the magnitude words `tuvsán` 10³ / `millijåvnnå` 10⁶ / `millijárdda` 10⁹ are old Scandinavian
 * loans, but they are the only forms the language has).
 *
 * SOURCE (primary): the Divvun/Giellatekno Lule Sami digit→text transducer,
 * `giellalt/lang-smj:src/fst/transcriptions/transcriptor-numbers-digit2text.lexc`, whose own comments mark
 * the preferred branch as the one for text-to-speech. This composer reproduces that normative branch. The
 * full sourcing — every stem alternation, every documented simplification, and the `+Use/NG` variants that
 * are deliberately NOT emitted — is in the TypeScript original, src/languages/lulesami/numbers.ts.
 *
 * ⚠ ORTHOGRAPHIC SHAPE — Lule Sami writes a cardinal SOLID, as ONE word, Finnish-style, all the way through
 * the thousands: 12 345 is the single word `guoktalågenantuvsángålmmåtjuotnielljalåkvihtta`. Only 10⁶/10⁹
 * are separate words. So the SPACES this returns are real word boundaries — the caller phonemizes each
 * space-separated word — and there is exactly one space per million/milliard.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.LuleSami;

public static class Numbers
{
    /** `Number.isSafeInteger` — the local idiom the fleet uses; there is no BCL equivalent. */
    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    // Units 1–9 (index 0 unused — a bare 0 is `nålla`, handled in NumberToWords).
    private static readonly string[] UNITS =
        { "", "akta", "guokta", "gålmmå", "niellja", "vihtta", "guhtta", "gietjav", "gáktsa", "aktse" };
    private const string ZERO = "nålla";
    private const string TEN_FREE = "lågev";      // 10 standing alone
    private const string TEN_TENS = "låhke";      // ×10 with no following unit (guoktalåhke 20)
    private const string TEN_BOUND = "låk";       // ×10 with a following unit (guoktalåkakta 21)
    private const string TEEN = "lågenan";        // the 11–19 element
    private const string HUNDRED = "tjuohte";     // 100 / X00, free or before a remainder
    private const string HUNDRED_MULT = "tjuode"; // X00 as a magnitude multiplier — the only branch there
    private const string THOUSAND = "tuvsán";
    private const string MILLION = "millijåvnnå";
    private const string MILLIARD = "millijárdda";

    /** 1 ≤ n < 100. `mult` = this number multiplies a magnitude, which FLIPS the teen order to
     *  unit + `lågenan` (12 000 → guoktalågenantuvsán). The flip is the transducer's, not a slip. */
    private static string Below100(double n, bool mult)
    {
        if (n < 10) return UNITS[(int)n];
        if (n == 10) return TEN_FREE;
        if (n < 20) return mult ? UNITS[(int)n - 10] + TEEN : TEEN + UNITS[(int)n - 10];
        var t = Math.Floor(n / 10);
        var u = n % 10;
        return u == 0 ? UNITS[(int)t] + TEN_TENS : UNITS[(int)t] + TEN_BOUND + UNITS[(int)u];
    }

    /** 1 ≤ n < 1000, written solid. `mult` selects the magnitude-multiplier hundred stem `tjuode`. */
    private static string Below1000(double n, bool mult)
    {
        var h = Math.Floor(n / 100);
        var r = n % 100;
        if (h == 0) return Below100(n, mult);
        var head = h == 1 ? HUNDRED : UNITS[(int)h] + (mult ? HUNDRED_MULT : HUNDRED);
        return r == 0 ? head : head + Below100(r, mult);
    }

    /** 1 ≤ n < 10⁶, written solid (the thousand and its remainder concatenate: 1001 → tuvsánakta). */
    private static string Below1e6(double n)
    {
        var th = Math.Floor(n / 1000);
        var r = n % 1000;
        if (th == 0) return Below1000(n, false);
        var head = th == 1 ? THOUSAND : Below1000(th, true) + THOUSAND;
        return r == 0 ? head : head + Below1000(r, false);
    }

    /**
     * Read a digit string one digit at a time (the above-10¹² / unsafe-integer fallback).
     *
     * ⚠ CODE POINTS, NOT CODE UNITS: the TS spells this `[...digits]`, which iterates code POINTS and so
     * keeps an astral pair together. That is the opposite of the Latvian/Lithuanian `split("")` sites, and
     * the difference is the TS's, not a choice made here.
     */
    public static string ReadDigits(string digits) =>
        string.Join(" ", Js.CodePoints(digits)
            .Select(d => d == "0" ? ZERO : Core.Numbers.DigitWord(UNITS, d) ?? d));

    /**
     * Non-negative integer → Lule Sami cardinal words, space-separated ONLY at the 10⁶/10⁹ seams.
     * ≥10¹² or non-safe → digit-by-digit, because the transducer itself stops at the milliard: there is no
     * attested Lule Sami word for 10¹².
     */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!IsSafeInteger(n) || n < 0 || n >= 1e12) return ReadDigits(raw ?? Js.NumberToString(n));
        if (n == 0) return ZERO;
        if (n < 1e6) return Below1e6(n);
        if (n < 1e9)
        {
            var m = Math.Floor(n / 1e6);
            var r = n % 1e6;
            var head = m == 1 ? MILLION : $"{Below1000(m, true)} {MILLION}";
            return r == 0 ? head : $"{head} {Below1e6(r)}";
        }
        var b = Math.Floor(n / 1e9);
        var rem = n % 1e9;
        var bhead = b == 1 ? MILLIARD : $"{Below1000(b, true)} {MILLIARD}";
        return rem == 0 ? bhead : $"{bhead} {NumberToWords(rem)}";
    }
}

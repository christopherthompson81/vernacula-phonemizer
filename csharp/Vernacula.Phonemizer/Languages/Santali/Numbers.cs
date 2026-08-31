/**
 * Santali (sat) cardinal number → words, in OL CHIKI (ᱚᱞ ᱪᱮᱢᱮᱫ). The NATIVE MUNDA DECIMAL series for
 * 1–99 with the INDO-ARYAN LOAN magnitudes above it, and Indian 2-2-3 grouping (thousand → lakh 10⁵ →
 * crore 10⁷). There is no Santali word for "million" or "billion", so 10⁶ reads ᱜᱮᱞ ᱞᱟᱠᱷ (ten lakh) and
 * 10⁹ reads ᱢᱤᱫ ᱥᱟᱭ ᱠᱚᱨᱚᱲ (a hundred crore) — the correct reading, not a workaround.
 *
 * Ported from src/languages/santali/numbers.ts — see that file for the sources (Ghosh's grammar,
 * Wiktionary's Ol Chiki lemmas, sat.wikipedia running prose), for the native-vs-borrowed decision, and
 * for each of the orthographic forks (4 = ᱯᱩᱱ not ᱯᱳᱱ, 8 = ᱤᱨᱟᱹᱞ with the required GAAHLAA, 100 = ᱥᱟᱭ
 * not the homograph ᱥᱳ, and the multiplier 1 being WRITTEN: 100 is ᱢᱤᱫ ᱥᱟᱭ).
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Santali;

public static class Numbers
{
    /** 0–10. Directly attested Ol Chiki spellings — see the TS header for the per-form choices. */
    private static readonly string[] UNITS =
    [
        "ᱥᱩᱱ",    // 0 sun (IA loan — no native Munda zero)
        "ᱢᱤᱫ",    // 1 mit' (the checked final is not written in Ol Chiki)
        "ᱵᱟᱨ",    // 2 bar
        "ᱯᱮ",     // 3 pe
        "ᱯᱩᱱ",    // 4 pun
        "ᱢᱚᱬᱮ",   // 5 mɔɽe
        "ᱛᱩᱨᱩᱭ",  // 6 turuy
        "ᱮᱭᱟᱭ",   // 7 eyay
        "ᱤᱨᱟᱹᱞ",  // 8 irəl — the ᱹ GAAHLAA is required
        "ᱟᱨᱮ",    // 9 are
        "ᱜᱮᱞ",    // 10 gel — also the base of the teens and the tens
    ];

    private const string TEN = "ᱜᱮᱞ";
    private const string HUNDRED = "ᱥᱟᱭ";      // say (IA loan)
    private const string THOUSAND = "ᱦᱟᱡᱟᱨ";   // hazar (< Persian هزار)
    private const string LAKH = "ᱞᱟᱠᱷ";        // 10⁵
    private const string CRORE = "ᱠᱚᱨᱚᱲ";      // 10⁷

    /** 1 ≤ n < 100. Purely additive, descending, SPACED, no conjunction: ᱵᱟᱨ ᱜᱮᱞ ᱢᱚᱬᱮ = 25. */
    private static string Below100(double n)
    {
        if (n <= 10) return UNITS[(int)n];
        if (n < 20) return $"{TEN} {UNITS[(int)n - 10]}"; // ᱜᱮᱞ ᱢᱤᱫ = 11
        double t = Math.Floor(n / 10), u = n % 10;
        return u == 0 ? $"{UNITS[(int)t]} {TEN}" : $"{UNITS[(int)t]} {TEN} {UNITS[(int)u]}";
    }

    /** 1 ≤ n < 1000. The multiplier 1 IS written: 100 = ᱢᱤᱫ ᱥᱟᱭ. */
    private static string Below1000(double n)
    {
        double h = Math.Floor(n / 100), r = n % 100;
        if (h == 0) return Below100(n);
        var head = $"{UNITS[(int)h]} {HUNDRED}";
        return r == 0 ? head : $"{head} {Below100(r)}";
    }

    /** 1 ≤ n < 10⁵ (thousands; the multiplier is 1–99). */
    private static string Below1e5(double n)
    {
        double th = Math.Floor(n / 1000), r = n % 1000;
        if (th == 0) return Below1000(n);
        var head = $"{Below100(th)} {THOUSAND}";
        return r == 0 ? head : $"{head} {Below1000(r)}";
    }

    /** 1 ≤ n < 10⁷ (lakhs; the multiplier is 1–99 — the Indian 2-2-3 grouping). */
    private static string Below1e7(double n)
    {
        double l = Math.Floor(n / 1e5), r = n % 1e5;
        if (l == 0) return Below1e5(n);
        var head = $"{Below100(l)} {LAKH}";
        return r == 0 ? head : $"{head} {Below1e5(r)}";
    }

    /** Read a digit string one digit at a time (the non-safe-integer fallback). */
    public static string ReadDigits(string digits) =>
        string.Join(" ", Js.CodePoints(digits).Select(d => Core.Numbers.DigitWord(UNITS, d) ?? d));

    /** JS `Number.isSafeInteger(n)`: an integral double inside ±(2^53 − 1). */
    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    /**
     * Non-negative integer → Santali cardinal words in Ol Chiki, space-separated. Indian 2-2-3 grouping
     * with lakh/crore; the crore multiplier RECURSES, so 10⁹ reads ᱢᱤᱫ ᱥᱟᱭ ᱠᱚᱨᱚᱲ ('a hundred crore').
     * Non-safe → digit-by-digit. ⚠ THE RAW TOKEN GOES ALONG so the digit arm reads the digits the text
     * wrote rather than a double that has already lost them.
     */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!IsSafeInteger(n) || n < 0) return ReadDigits(raw ?? Js.NumberToString(n));
        if (n == 0) return UNITS[0];
        if (n < 1e7) return Below1e7(n);
        double c = Math.Floor(n / 1e7), r = n % 1e7;
        var head = $"{NumberToWords(c)} {CRORE}";
        return r == 0 ? head : $"{head} {Below1e7(r)}";
    }
}

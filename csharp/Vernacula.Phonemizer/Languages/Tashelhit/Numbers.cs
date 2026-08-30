/**
 * Tashelhit / Shilha (shi) cardinal number → words, in the Berber Latin alphabet.
 * SYSTEM: MOROCCAN ARABIC LOAN numerals, with NATIVE Berber kept for 1–3 — the split the one practical
 * teaching source states flatly ("In TashlHeet we usually use Arabic numbers except for the numbers: one,
 * two and three"). Ported from src/languages/tashelhit/numbers.ts, where the sourcing lives in full.
 *
 * COMPOSITION: units-FIRST inside the final tens+units pair, joined by `u` (45 = xmsa u rbɛin); everything
 * else largest→smallest, also joined by `u`. Hundreds 100 mya / 200 the DUAL myatayn / 300–900 SHORT stem +
 * mya. Thousands 1000 alf / 2000 alfayn / 3000–10000 SHORT + the PLURAL alaf / 11000+ the singular again.
 * Range 0 … 10¹²−1; beyond that, and for any non-safe integer, digit-by-digit.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Tashelhit;

public static class Numbers
{
    // 0–10. 1–3 are NATIVE Berber (masculine); 4–10 are the Moroccan Arabic loans.
    private static readonly string[] UNITS =
    [
        "ṣifr",   // 0 — Arabic loan; no native Berber zero
        "yan",    // 1 native (also the indefinite article; never `waḥd` standalone)
        "sin",    // 2 native
        "kraḍ",   // 3 native
        "rbɛa",   // 4 Arabic
        "xmsa",   // 5
        "stta",   // 6
        "sbɛa",   // 7
        "tmnya",  // 8
        "tsɛud",  // 9
        "ɛcra",   // 10
    ];

    /** The forms a unit takes INSIDE a tens+units compound: Arabic waḥd/tnayn replace native yan/sin. 3 keeps
     *  native kraḍ because no free Arabic form for 3 is attested — see the TS header's SEAMS note. */
    private static readonly string[] COMPOUND_UNITS =
        UNITS.Select((w, i) => i == 1 ? "waḥd" : i == 2 ? "tnayn" : w).ToArray();

    private static readonly string[] TEENS =
        ["ḥdac", "tnac", "tltac", "rbɛtac", "xmstac", "sttac", "sbɛtac", "tmntac", "tsɛtac"];

    /** Round tens, keyed by the tens DIGIT. 20 `ɛcrin` is an Arabic loan with no native competitor at all. */
    private static readonly IReadOnlyDictionary<int, string> TENS = new Dictionary<int, string>
    {
        [2] = "ɛcrin", [3] = "tlatin", [4] = "rbɛin", [5] = "xmsin",
        [6] = "sttin", [7] = "sbɛin", [8] = "tmanin", [9] = "tsɛin",
    };

    /** The SHORT (bound) stems used before mya / alaf: tlt mya, xms alaf. */
    private static readonly IReadOnlyDictionary<int, string> SHORT = new Dictionary<int, string>
    {
        [3] = "tlt", [4] = "rbɛ", [5] = "xms", [6] = "stt", [7] = "sbɛ", [8] = "tmn", [9] = "tsɛ", [10] = "ɛcr",
    };

    private const string AND = "u";
    private const string HUNDRED = "mya", HUNDRED_DUAL = "myatayn";
    private const string THOUSAND = "alf", THOUSAND_DUAL = "alfayn", THOUSAND_PLURAL = "alaf";
    private const string MILLION = "mlyun", MILLION_PLURAL = "mlayn";
    private const string BILLION = "mlyar", BILLION_PLURAL = "mlayr";

    /** JS `Number.isSafeInteger` — the fleet spells this out per language. */
    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    /** 1 ≤ n < 100. Units-FIRST in the compound: xmsa u rbɛin = 45. */
    private static string Below100(double n)
    {
        if (n <= 10) return UNITS[(int)n];
        if (n < 20) return TEENS[(int)n - 11];
        int t = (int)Math.Floor(n / 10), u = (int)(n % 10);
        return u == 0 ? TENS[t] : $"{COMPOUND_UNITS[u]} {AND} {TENS[t]}";
    }

    /** 1 ≤ n < 1000. 100 mya · 200 myatayn (dual) · 300–900 SHORT + mya. */
    private static string Below1000(double n)
    {
        int h = (int)Math.Floor(n / 100);
        double r = n % 100;
        if (h == 0) return Below100(n);
        var head = h == 1 ? HUNDRED : h == 2 ? HUNDRED_DUAL : $"{SHORT[h]} {HUNDRED}";
        return r == 0 ? head : $"{head} {AND} {Below100(r)}";
    }

    /** The thousands head: alf · alfayn (dual) · SHORT + alaf (3–10) · below1000 + alf (11+). */
    private static string ThousandsHead(double th)
    {
        if (th == 1) return THOUSAND;
        if (th == 2) return THOUSAND_DUAL;
        if (th <= 10) return $"{SHORT[(int)th]} {THOUSAND_PLURAL}";
        return $"{Below1000(th)} {THOUSAND}";
    }

    /** 1 ≤ n < 10⁶. */
    private static string Below1e6(double n)
    {
        double th = Math.Floor(n / 1000), r = n % 1000;
        if (th == 0) return Below1000(n);
        var head = ThousandsHead(th);
        return r == 0 ? head : $"{head} {AND} {Below1000(r)}";
    }

    /** A million/milliard head, on the alf/alaf model (see the TS header's by-analogy note). */
    private static string BigHead(double count, string sg, string pl)
    {
        if (count == 1) return sg;
        if (count <= 10) return $"{COMPOUND_UNITS[(int)count]} {pl}";
        return $"{Below1000(count)} {sg}";
    }

    /**
     * Read a digit string one digit at a time (the ≥10¹² / unsafe-integer fallback).
     * ⚠ CODE POINTS, NOT CHARS — the TS spreads the string (`[...digits]`), which yields whole code points;
     * iterating a C# string yields UTF-16 CODE UNITS and would split an astral character into two lone
     * surrogates. The #1193 class. And the guard is `DigitWord`'s ASCII-digit test, not `Js.Number`, which
     * answers 0 for a whitespace character and would read a stray separator as the word for ZERO (#1165).
     */
    public static string ReadDigits(string digits) =>
        string.Join(" ", Js.CodePoints(digits).Select(d => Core.Numbers.DigitWord(UNITS, d) ?? d));

    /**
     * Non-negative integer → Tashelhit cardinal words: Moroccan Arabic loans with native Berber 1–3,
     * largest→smallest joined by `u`, units-first in the final tens+units pair. ≥10¹² or non-safe →
     * digit-by-digit.
     */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!IsSafeInteger(n) || n < 0 || n >= 1e12) return ReadDigits(raw ?? Js.NumberToString(n));
        if (n == 0) return UNITS[0];
        if (n < 1e6) return Below1e6(n);
        if (n < 1e9)
        {
            double m = Math.Floor(n / 1e6), r = n % 1e6;
            var head = BigHead(m, MILLION, MILLION_PLURAL);
            return r == 0 ? head : $"{head} {AND} {Below1e6(r)}";
        }
        double b = Math.Floor(n / 1e9), rb = n % 1e9;
        var bhead = BigHead(b, BILLION, BILLION_PLURAL);
        return rb == 0 ? bhead : $"{bhead} {AND} {NumberToWords(rb)}";
    }
}

/**
 * K'iche' (quc) cardinal number → words. VIGESIMAL (base 20) — hence Pattern B: there is no decimal tens
 * series at all, so `NumbersDef` cannot express it. Numerals are in the ALMG Latin orthography, which
 * Kiche.cs phonemizes directly.
 * Ported from src/languages/kiche/numbers.ts — see that file for the ALMG sourcing and the disclosures
 * (the three score bases, the additive-only norm, the non-normative zero, the ≥4000 digit fallback).
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kiche;

public static class Numbers
{
    private const string ZERO = "majb'al"; // NON-NORMATIVE neologism — see the TS header
    // 1..10, verbatim ALMG §1.7.4.
    private static readonly string[] UNITS =
        { "", "jun", "keb'", "oxib'", "kajib'", "job'", "waqib'", "wuqub'", "wajxaqib'", "b'elejeb'", "lajuj" };
    // 11..19 (index 0 = 11): the ⟨-lajuj⟩ series, verbatim ALMG §1.7.4.
    private static readonly string[] TEENS =
        { "julajuj", "kab'lajuj", "oxlajuj", "kajlajuj", "jolajuj", "waqlajuj", "wuqlajuj", "wajxaqlajuj", "b'elejlajuj" };
    // The multiples of TWENTY, index 1..19 → 20…380. Verbatim ALMG §1.7.4 (three different bases — see the TS).
    private static readonly string[] SCORES =
    {
        "", "juwinaq", "kawinaq", "oxk'al", "jumuch'", "jok'al", "waqk'al", "wuqk'al", "wajxaqk'al", "b'elejk'al",
        "lajk'al", "julajujk'al", "kab'lajk'al", "oxlajk'al", "kajlajk'al", "jolajk'al", "waqlajk'al", "wuqlajk'al",
        "wajxaqlajk'al", "b'elejlajk'al",
    };
    // The numeral-prefix combining forms, used to build the ⟨q'o⟩ multiples. Only ju- (400) and ka- (800)
    // are ATTESTED with q'o; 3–9 are extrapolated (see the TS header).
    private static readonly string[] PREFIX = { "", "ju", "ka", "ox", "kaj", "jo", "waq", "wuq", "wajxaq", "b'elej" };
    private const string FOUR_HUNDRED = "juq'o"; // attested spelling for 1×400 (no final glottal)

    /** 1 ≤ n ≤ 19. */
    private static string Below20(double n) =>
        n <= 10 ? UNITS[(int)n] : TEENS[(int)n - 11];

    /** 1 ≤ n < 400: a score word plus an ADDITIVE remainder (101 → "jok'al jun"). */
    private static string Below400(double n)
    {
        if (n < 20) return Below20(n);
        var s = Math.Floor(n / 20);
        var r = n % 20;
        return r == 0 ? SCORES[(int)s] : $"{SCORES[(int)s]} {Below20(r)}";
    }

    /** Non-negative integer → K'iche' words. ≥ 4000 (nothing documented) → digit-by-digit. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 4000)
        {
            // ⚠ THE RAW TOKEN GOES ALONG, so the digit arm reads the digits the text wrote rather than a
            // double that above 2^53 has already lost its low digits. JS `[...s]` spreads by CODE POINT.
            var sb = new StringBuilder();
            foreach (var c in Js.CodePoints(raw ?? Js.NumberToString(Math.Abs(n))))
            {
                if (c[0] < '0' || c[0] > '9') continue;
                if (sb.Length > 0) sb.Append(' ');
                sb.Append(c[0] == '0' ? ZERO : UNITS[c[0] - '0']);
            }
            return sb.ToString();
        }
        if (n == 0) return ZERO;
        if (n < 400) return Below400(n);
        var q = Math.Floor(n / 400);
        var r = n % 400;
        var head = q == 1 ? FOUR_HUNDRED : $"{PREFIX[(int)q]}q'o'"; // kaq'o' (800) attested; 3–9 extrapolated
        return r == 0 ? head : $"{head} {Below400(r)}";
    }
}

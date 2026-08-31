/**
 * Luo / Dholuo cardinal number → words. DECIMAL, and bespoke for one reason the data schema cannot carry:
 * the additive coordinator gi 'and' ELIDES its vowel before a vowel-initial word, and every Dholuo unit is
 * vowel-initial (a-/o-), so the coordinator is written SOLID with the unit — apar gachiel 11 — but stays free
 * before the consonant-initial magnitude words (mia ariyo gi piero adek). 1000+ uses the everyday borrowed
 * elfu / milion / bilion.
 * Ported from src/languages/luo/numbers.ts — see that file for the sourcing and the traditional-vs-modern note.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Luo;

public static class Numbers
{
    private static readonly string[] ONES =
    {
        "nono", "achiel", "ariyo", "adek", "ang'wen", "abich", "auchiel", "abiriyo", "aboro", "ochiko",
    };
    private const string TEN = "apar";
    private const string TENS = "piero"; // 'tens' — takes a following multiplier
    private const string HUNDRED = "mia";
    private const string THOUSAND = "elfu";
    private const string MILLION = "milion";
    private const string BILLION = "bilion";
    private static readonly HashSet<string> VOWELS =
        new(Manifest.MANIFEST.SpellingVowels, StringComparer.Ordinal); // ORTHOGRAPHIC (luo.jsonc), never core/ipa.ts

    /** The coordinator gi 'and': elides to a solid g- before a vowel-initial word, stays free before a consonant. */
    private static string And(string w) => VOWELS.Contains(w[0].ToString()) ? $"g{w}" : $"gi {w}";

    /** 0–99. */
    private static string Below100(double n)
    {
        if (n < 10) return ONES[(int)n];
        var t = (int)Math.Floor(n / 10);
        var u = (int)(n % 10);
        var head = t == 1 ? TEN : $"{TENS} {ONES[t]}";
        return u == 0 ? head : $"{head} {And(ONES[u])}";
    }

    /** 1–999. */
    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        var h = (int)Math.Floor(n / 100);
        var r = n % 100;
        var head = $"{HUNDRED} {ONES[h]}";
        return r == 0 ? head : $"{head} {And(Below100(r))}";
    }

    /** Non-negative integer → Dholuo words; out of range → digit-by-digit. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e12)
        {
            // ⚠ THE RAW TOKEN GOES ALONG, so the digit arm reads the digits the text wrote rather than a
            // double that above 2^53 has already lost its low digits. JS `[...s]` spreads by CODE POINT.
            var sb = new StringBuilder();
            foreach (var c in Js.CodePoints(raw ?? Js.NumberToString(Math.Abs(n))))
            {
                if (c[0] < '0' || c[0] > '9') continue;
                if (sb.Length > 0) sb.Append(' ');
                sb.Append(ONES[c[0] - '0']);
            }
            return sb.ToString();
        }
        if (n < 1000) return Below1000(n);
        if (n < 1e6)
        {
            var th = (int)Math.Floor(n / 1000);
            var rem = n % 1000;
            return $"{THOUSAND} {Below1000(th)}{(rem == 0 ? "" : $" {And(Below1000(rem))}")}";
        }
        if (n < 1e9)
        {
            var m = (int)Math.Floor(n / 1e6);
            var rem2 = n % 1e6;
            return $"{MILLION} {Below1000(m)}{(rem2 == 0 ? "" : $" {And(NumberToWords(rem2))}")}";
        }
        var b = (int)Math.Floor(n / 1e9);
        var rem3 = n % 1e9;
        return $"{BILLION} {Below1000(b)}{(rem3 == 0 ? "" : $" {And(NumberToWords(rem3))}")}";
    }
}

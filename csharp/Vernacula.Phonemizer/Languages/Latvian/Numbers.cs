/**
 * Latvian (lv) cardinal number compositor. Returns composed Latvian TEXT that the phonemizer then runs
 * through the g2p, so the IPA stays consistent with the word engine. Ported from
 * src/languages/latvian/numbers.ts.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Latvian;

public static class Numbers
{
    private static LatvianNumbers N => Manifest.MANIFEST.Numbers;
    private static IReadOnlyList<string> UNITS => N.Units;
    private static IReadOnlyList<string> TEENS => N.Teens;
    private static IReadOnlyList<string> TENS => N.Tens;

    /** 0–99 → Latvian text (tens + space + units: divdesmit viens). */
    private static string Sub100(double n)
    {
        if (n < 10) return UNITS[(int)n];
        if (n < 20) return TEENS[(int)n - 10];
        int t = (int)Math.Floor(n / 10), u = (int)(n % 10);
        return u == 0 ? TENS[t] : $"{TENS[t]} {UNITS[u]}";
    }

    /** 1–999 → Latvian text. Hundreds: 1→simts, else (count) simti; then the sub-hundred remainder. */
    private static string Sub1000(double n)
    {
        int h = (int)Math.Floor(n / 100);
        double r = n % 100;
        if (h == 0) return Sub100(r);
        var hw = h == 1 ? N.Hundred.One : $"{Sub100(h)} {N.Hundred.Many}";
        return r != 0 ? $"{hw} {Sub100(r)}" : hw;
    }

    /** The counted-noun form by Latvian agreement: SINGULAR after a count ending in …1 but NOT …11. */
    private static string Agree(double count, CountedNoun forms) =>
        count % 10 == 1 && count % 100 != 11 ? forms.One : forms.Many;

    /** A magnitude group: 1 tūkstotis DROPS the numeral (idiomatic), 1 miljons keeps "viens".
     *  ⚠ The numerals are MASCULINE-DEFAULT — Latvian 1/2 also inflect for gender (viena/divas), which is
     *  context-dependent and unverifiable here, so it is deferred exactly as the TS defers it. */
    private static string MagnitudeGroup(double count, CountedNoun forms, bool keepOne)
    {
        if (count == 1) return keepOne ? $"{UNITS[1]} {forms.One}" : forms.One;
        return $"{Sub1000(count)} {Agree(count, forms)}";
    }

    /**
     * Read a raw digit STRING digit-by-digit — the fallback for out-of-range / over-long numbers.
     * ⚠ CODE UNITS, NOT CODE POINTS, AND THAT IS THE FAITHFUL READING: the TS spells this `digits.split("")`,
     * and `String.prototype.split("")` splits by UTF-16 CODE UNIT. Spreading with `[...]` — what #1193
     * corrected six OTHER languages to — would be a divergence here, as it would be for afrikaans, georgian
     * and the Latgalian sibling.
     */
    public static string ReadDigits(string digits) =>
        string.Join(" ", digits.Select(d => Core.Numbers.DigitWord(UNITS, d.ToString()) ?? d.ToString()));

    /** A non-negative integer (< 1e9) → space-separated Latvian cardinal words. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (n < 0 || double.IsNaN(n) || double.IsInfinity(n)) return "";
        n = Math.Floor(n);
        if (n == 0) return UNITS[0];
        if (n >= 1e9) return ReadDigits(raw ?? Js.NumberToString(n));
        var parts = new List<string>();
        var mil = Math.Floor(n / 1e6);
        n %= 1e6;
        if (mil != 0) parts.Add(MagnitudeGroup(mil, N.Million, true));   // 1 → "viens miljons"
        var th = Math.Floor(n / 1000);
        n %= 1000;
        if (th != 0) parts.Add(MagnitudeGroup(th, N.Thousand, false));   // 1 → "tūkstotis" (numeral dropped)
        if (n != 0) parts.Add(Sub1000(n));
        return string.Join(" ", parts);
    }
}

/**
 * TURKMEN (tk) cardinal number composition — Oghuz Turkic, Latin script. Kept out of Turkmen.cs so that
 * Normalize.cs can build ORDINALS on the same words without a circular dependency, the same split ba, tt
 * and chv have. The DATA and its provenance live in turkmen.jsonc under `numbers`.
 *
 * Thousands-scaled decimal: every round ten is its own lexeme (10 = on sits in `tens`) and the parts are
 * simply JUXTAPOSED with no connector. The multiplier "bir" is DROPPED before ýüz (100 = ýüz) but KEPT
 * before müň and million/milliard — the cited grammar's worked example is "bir müň dokuz ýüz togsan iki".
 * Ported from src/languages/turkmen/numbers.ts.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Turkmen;

public static class Numbers
{
    /** JS `Number.isSafeInteger(n)`: an integral double inside ±2^53 − 1. */
    internal static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    public static List<string?> TurkmenNumberWords(double n, NumbersDef d)
    {
        if (n < 10) return [d.Units[(int)n]];
        if (n < 100)
        {
            double t = Math.Floor(n / 10) * 10, u = n % 10;
            var outp = new List<string?> { d.Tens[Js.NumberToString(t)] };
            if (u != 0) outp.Add(d.Units[(int)u]);
            return outp;
        }
        if (n < 1000)
        {
            double h = Math.Floor(n / 100), r = n % 100;
            var outp = new List<string?>();
            if (h > 1) outp.Add(d.Units[(int)h]); // the multiplier "bir" is dropped before ýüz
            outp.Add(d.Magnitudes.Hundred);
            if (r != 0) outp.AddRange(TurkmenNumberWords(r, d));
            return outp;
        }
        if (n < 1_000_000)
        {
            double th = Math.Floor(n / 1000), r = n % 1000;
            var outp = new List<string?>(TurkmenNumberWords(th, d)) { d.Magnitudes.Thousand }; // …but KEPT before müň
            if (r != 0) outp.AddRange(TurkmenNumberWords(r, d));
            return outp;
        }
        if (n < 1_000_000_000)
        {
            double m = Math.Floor(n / 1_000_000), r = n % 1_000_000;
            var outp = new List<string?>(TurkmenNumberWords(m, d)) { d.Magnitudes.Million };
            if (r != 0) outp.AddRange(TurkmenNumberWords(r, d));
            return outp;
        }
        double b = Math.Floor(n / 1_000_000_000), rem = n % 1_000_000_000;
        var res = new List<string?>(TurkmenNumberWords(b, d)) { d.Magnitudes.Billion };
        if (rem != 0) res.AddRange(TurkmenNumberWords(rem, d));
        return res;
    }

    /** A non-negative safe integer → the ordered Turkmen number WORDS (spellings, not IPA). */
    public static List<string> NumberToWords(double n) =>
        TurkmenNumberWords(n, Manifest.DEF.Numbers).Where(w => w != null).Select(w => w!).ToList();
}

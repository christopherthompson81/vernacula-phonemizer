/**
 * KYRGYZ (ky) cardinal number composition — Kipchak Turkic, Cyrillic. The data atoms live in kyrgyz.jsonc
 * (a NumbersDef); this is the compositor, whose one deviation from the Uzbek/Turkic shape is that the
 * THOUSAND multiplier keeps its leading 1 (бир миң) while the HUNDRED omits it (жүз). The words are in
 * Kyrgyz's OWN orthography and phonemized by the g2p (never hand IPA).
 * Ported from src/languages/kyrgyz/kyrgyz.ts (kyrgyzNumberWords / numberWords) — see that file for the
 * corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kyrgyz;

public static class Numbers
{
    private static NumbersDef NUM => Manifest.DEF.Numbers;

    /**
     * Turkic decimal composition: tens + units + hundred/thousand/million/billion, all SPACE-separated
     * (жыйырма бир = 21).
     *
     * ⚠ THE HUNDRED-MULTIPLIER OMITS A LEADING 1 AND THE THOUSAND-MULTIPLIER DOES NOT — жүз, but **бир** миң.
     * ky.wikipedia settles it in two independent places (its YEAR ARTICLES gloss the digits, and its
     * orthography article's §49 writes «бир миң тогуз жүз токсон беш» beside «жүз элүү эки»).
     */
    public static List<string?> Compose(double n, NumbersDef d)
    {
        if (n < 10) return [d.Units[(int)n]];
        if (n < 100)
        {
            double t = Math.Floor(n / 10) * 10, u = n % 10;
            var outp = new List<string?> { d.Tens[Js.NumberToString(t)] }; // tens includes "10" (он)
            if (u != 0) outp.Add(d.Units[(int)u]);
            return outp;
        }
        if (n < 1000)
        {
            double h = Math.Floor(n / 100), r = n % 100;
            var outp = new List<string?>();
            if (h > 1) outp.Add(d.Units[(int)h]);
            outp.Add(d.Magnitudes.Hundred);
            if (r != 0) outp.AddRange(Compose(r, d));
            return outp;
        }
        if (n < 1_000_000)
        {
            double th = Math.Floor(n / 1000), r = n % 1000;
            var outp = new List<string?>(Compose(th, d)) { d.Magnitudes.Thousand };
            if (r != 0) outp.AddRange(Compose(r, d));
            return outp;
        }
        if (n < 1_000_000_000)
        {
            double m = Math.Floor(n / 1_000_000), r = n % 1_000_000;
            var outp = new List<string?>(Compose(m, d)) { d.Magnitudes.Million };
            if (r != 0) outp.AddRange(Compose(r, d));
            return outp;
        }
        double b = Math.Floor(n / 1_000_000_000), rb = n % 1_000_000_000;
        var res = new List<string?>(Compose(b, d)) { d.Magnitudes.Billion };
        if (rb != 0) res.AddRange(Compose(rb, d));
        return res;
    }

    /**
     * Integer → its Kyrgyz cardinal in ORTHOGRAPHY, space-separated; null above 10¹² or off the safe-integer
     * range. This is what Normalize.cs needs (an ordinal suffix, a case suffix and a fraction denominator all
     * attach to the LAST WORD of a spoken numeral, and a digit run has no last word until composed).
     */
    public static string? NumberWords(double n)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1_000_000_000_000)
            return null;
        return string.Join(" ", Compose(n, NUM).Where(w => w is not null && w != "").Select(w => w!));
    }
}

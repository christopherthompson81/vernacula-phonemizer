/**
 * Uzbek (uz) number WORDS — cardinal and ordinal, shared by the engine (Uzbek.cs) and the normalization
 * layer (Normalize.cs). Turkic decimal composition, space-concatenated, with the ordinal suffix on the LAST
 * word only.
 * Ported from src/languages/uzbek/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Uzbek;

public static class Numbers
{
    private static NumbersDef NUM => Manifest.DEF.Numbers;

    /** Turkic decimal composition: units + tens + hundred/thousand/… concatenated (no fusion, space-separated). */
    public static List<string?> TurkicNumberWords(double n, NumbersDef d)
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
            if (h > 1) outp.Add(d.Units[(int)h]);
            outp.Add(d.Magnitudes.Hundred);
            if (r != 0) outp.AddRange(TurkicNumberWords(r, d));
            return outp;
        }
        if (n < 1_000_000)
        {
            double th = Math.Floor(n / 1000), r = n % 1000;
            var outp = new List<string?>();
            if (th > 1) outp.AddRange(TurkicNumberWords(th, d));
            outp.Add(d.Magnitudes.Thousand);
            if (r != 0) outp.AddRange(TurkicNumberWords(r, d));
            return outp;
        }
        if (n < 1_000_000_000)
        {
            double m = Math.Floor(n / 1_000_000), r = n % 1_000_000;
            var outp = new List<string?>(TurkicNumberWords(m, d)) { d.Magnitudes.Million };
            if (r != 0) outp.AddRange(TurkicNumberWords(r, d));
            return outp;
        }
        double b = Math.Floor(n / 1_000_000_000), rb = n % 1_000_000_000;
        var res = new List<string?>(TurkicNumberWords(b, d)) { d.Magnitudes.Billion };
        if (rb != 0) res.AddRange(TurkicNumberWords(rb, d));
        return res;
    }

    /** Integer → Uzbek words. Undefined/null gaps render as "?"; returns "" for unrenderable input. */
    public static string NumberToWords(double n)
    {
        if (!double.IsFinite(n) || n < 0) return "";
        return string.Join(" ", TurkicNumberWords(Math.Floor(n), NUM).Select(w => w ?? "?"));
    }

    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    private static readonly JsRe ENDS_VOWEL = JsRegex.Compile("[aeiou]$", "u");

    /** Cardinal stem → ordinal: vowel-final → -nchi, consonant-final → -inchi. The comma-letter ʻ (U+02BB)
     *  is not a vowel, so `toʻrt` is correctly consonant-final. Same rule as RomanOrdinals.cs's `Suffixed`. */
    private static string Suffixed(string stem) => $"{stem}{(ENDS_VOWEL.IsMatch(stem) ? "" : "i")}nchi";

    /** Integer → the Uzbek ORDINAL, ordinalizing only the LAST element (1978 → … sakkizinchi). */
    public static string? OrdinalWords(double n)
    {
        if (!IsSafeInteger(n) || n < 1) return null;
        var words = TurkicNumberWords(n, NUM).Select(w => w ?? "").ToList();
        if (words.Count == 0 || words.Any(w => w == "")) return null;
        words[^1] = Suffixed(words[^1]);
        return string.Join(" ", words);
    }
}

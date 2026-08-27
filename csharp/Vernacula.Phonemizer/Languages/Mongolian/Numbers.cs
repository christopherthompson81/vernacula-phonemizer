/**
 * Mongolian (Khalkha) cardinal compositor → a Cyrillic number-word string, plus the digit-at-a-time fallback
 * for a run `NumberToWords` refuses. Every word but the last is rendered ATTRIBUTIVE.
 * Ported from src/languages/mongolian/numbers.ts — see that file for the inflection argument and for why the
 * above-2^53 refusal needed an else.
 */
namespace Vernacula.Phonemizer.Languages.Mongolian;

public static class Numbers
{
    private static MongolianNumbers N => Manifest.MANIFEST.Numbers;

    private readonly record struct W(string Abs, string Attr);

    private static W Unit(int d) => new(N.Units[d], N.UnitsAttr[d]);
    private static W Ten(int d) => new(N.Tens[d], N.TensAttr[d]);
    private static W Place(string w, string attr) => new(w, attr);

    /** Ordered word list for n (each word carries its absolute + attributive form). */
    private static List<W> Words(double n)
    {
        if (n == 0) return [Unit(0)];
        var outp = new List<W>();
        void Big(double divisor, string w, string attr)
        {
            var q = Math.Floor(n / divisor);
            if (q == 0) return;
            if (q >= 2) outp.AddRange(Words(q)); // a multiplier ≥2 precedes the place word (1× is bare)
            outp.Add(Place(w, attr));
            n %= divisor;
        }
        Big(1_000_000_000, N.Billion, N.Billion);
        Big(1_000_000, N.Million, N.Million);
        Big(1000, N.Thousand, N.ThousandAttr);
        Big(100, N.Hundred, N.HundredAttr);
        if (n >= 10) { outp.Add(Ten((int)Math.Floor(n / 10))); n %= 10; }
        if (n > 0) outp.Add(Unit((int)n));
        return outp;
    }

    /** The digit-at-a-time reading — the fallback for a digit run `NumberToWords` must refuse. Each digit is
     *  its own utterance, so every one takes the ABSOLUTE form. */
    public static string SpellDigits(string digits) =>
        string.Join(" ", digits.Where(c => c >= '0' && c <= '9').Select(c => Unit(c - '0').Abs));

    /** n → Cyrillic number words (space-separated); attributive for every word but the last. */
    public static string NumberToWords(double n)
    {
        // Guard beyond 2^53: Number() has already lost precision, so the composed words would be WRONG.
        if (!double.IsFinite(n) || n < 0 || n > 9007199254740991d) return "";
        var ws = Words(Math.Floor(n));
        return string.Join(" ", ws.Select((w, i) => i < ws.Count - 1 ? w.Attr : w.Abs));
    }
}

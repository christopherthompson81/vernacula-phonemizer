/**
 * Telugu cardinal number → words, Indian grouping (వెయ్యి 10³ / లక్ష 10⁵ / కోటి 10⁷).
 * Ported from src/languages/telugu/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Telugu;

public static class TeluguNumbersComposer
{
    private static TeluguNumbers N => Manifest.MANIFEST.Numbers;

    /** Non-negative integer → Telugu words. */
    public static string NumberToWords(double n) => string.Join(" ", Numbers.DravidianNumberWords(n, N));

    /** True for the band that takes the century reading; see the header. */
    public static bool IsCenturyYear(double n) => n >= 1100 && n <= 1999;

    /** 1100-1999 read as centuries: 1976 → పంతొమ్మిది వందల డెబ్బై ఆరు. Audio-arbitrated (header). */
    public static string YearToWords(double n)
    {
        if (!IsCenturyYear(n)) return NumberToWords(n);
        double century = Math.Floor(n / 100), rest = n % 100;
        var h = N.MagnitudeForms.Hundred;
        var hundred = rest > 0 ? h.PluralOblique : h.Plural;
        var parts = new List<string> { NumberToWords(century), hundred ?? "" };
        if (rest > 0) parts.Add(NumberToWords(rest));
        return string.Join(" ", parts);
    }

    /** The ORDINAL stem of a cardinal word. */
    public static string OrdinalStem(string word)
    {
        if (word.EndsWith("ు", StringComparison.Ordinal) || word.EndsWith("ి", StringComparison.Ordinal))
            return word[..^1];
        if (word.EndsWith("ై", StringComparison.Ordinal)) return $"{word[..^1]}య్య";
        return word;
    }

    /** N + వ, fused onto the final cardinal word (18వ → పద్దెనిమిదవ, 20వ → ఇరవయ్యవ). */
    public static string OrdinalToWords(double n, string suffix = "వ")
    {
        var words = (IsCenturyYear(n) ? YearToWords(n) : NumberToWords(n)).Split(' ');
        var last = words.Length > 0 ? words[^1] : null;
        if (last is null || last == "") return "";
        words[^1] = $"{OrdinalStem(last)}{suffix}";
        return string.Join(" ", words);
    }
}

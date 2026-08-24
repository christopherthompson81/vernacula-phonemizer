/**
 * Kannada cardinal number → words, Indian grouping (ಸಾವಿರ 10³ / ಲಕ್ಷ 10⁵ / ಕೋಟಿ 10⁷).
 * Ported from src/languages/kannada/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kannada;

public static class Numbers
{
    private static KannadaNumbers N => Manifest.MANIFEST.Numbers;

    /** The decimal separator word */
    public static string DECIMAL_WORD => N.DecimalWord;

    /** Non-negative integer → Kannada words, space-separated. */
    public static string NumberToWords(double n) =>
        string.Join(" ", Core.Numbers.DravidianNumberWords(n, N));

    /**
     * The ORDINAL stem of a cardinal word: Kannada drops the final -ು before ನೇ and writes the result FUSED.
     * A word with no final -ು takes the suffix directly.
     */
    public static string OrdinalStem(string word) =>
        word.EndsWith("ು", StringComparison.Ordinal) ? word[..^"ು".Length] : word;

    /** N + ನೇ, fused onto the final cardinal word (15ನೇ → ಹದಿನೈದನೇ, 20ನೇ → ಇಪ್ಪತ್ತನೇ). */
    public static string OrdinalToWords(double n, string suffix = "ನೇ")
    {
        var words = NumberToWords(n).Split(' ').ToList();
        var last = words.Count > 0 ? words[^1] : "";
        if (last == "") return "";
        words[^1] = $"{OrdinalStem(last)}{suffix}";
        return string.Join(" ", words);
    }
}

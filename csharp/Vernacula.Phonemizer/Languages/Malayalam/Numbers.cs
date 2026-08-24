/**
 * Malayalam cardinal number → words, plus the ordinal, oblique and plural morphology Normalize.cs needs.
 * Composition is the shared Dravidian composer (Core/Numbers.cs); this file is the Malayalam-facing
 * wrapper plus the three stems.
 * Ported from src/languages/malayalam/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Malayalam;

public static class NumbersMl
{
    private static MalayalamNumbers N => Manifest.MANIFEST.Numbers;
    private const string VIRAMA = "്";
    private const string ANUSVARA = "ം";

    /** The decimal separator word; read by Normalize.cs. */
    public static string DECIMAL_WORD => N.DecimalWord;

    // Hoisted: the TS spells this class out twice, in ordinalStem and obliqueStem. One compiled instance,
    // identical behaviour — the only literal-inventory difference between the two files.
    private static readonly JsRe VOWEL_SIGN_FINAL = JsRegex.Compile("[ാിീുൂെേൈൊോൗ]$", "u");

    /** Non-negative integer → Malayalam words, space-separated. */
    public static string NumberToWords(double n) => string.Join(" ", Numbers.DravidianNumberWords(n, N));

    /** The ORDINAL stem of a cardinal word — what -ാം attaches to. */
    public static string OrdinalStem(string word)
    {
        if (word.EndsWith(VIRAMA, StringComparison.Ordinal) || word.EndsWith(ANUSVARA, StringComparison.Ordinal))
            return word[..^1];
        return VOWEL_SIGN_FINAL.IsMatch(word) ? word + "യ" : word;
    }

    /** N + the ordinal ending, fused onto the last cardinal word. */
    public static string OrdinalToWords(double n, string ending = "ാം")
    {
        var words = NumberToWords(n).Split(' ');
        var last = words[^1];
        if (last.Length == 0) return "";
        words[^1] = OrdinalStem(last) + ending;
        return string.Join(" ", words);
    }

    /** The OBLIQUE stem — what a case clitic attaches to. */
    public static string ObliqueStem(string word)
    {
        if (word.EndsWith(VIRAMA, StringComparison.Ordinal)) return word[..^1] + "ി";
        if (word.EndsWith(ANUSVARA, StringComparison.Ordinal)) return word[..^1] + "ത്തി";
        return VOWEL_SIGN_FINAL.IsMatch(word) ? word + "യി" : word;
    }

    /** The PLURAL stem — what -കൾ and its case forms attach to; null for a word this rule declines. */
    public static string? PluralStem(string word) =>
        word.EndsWith(VIRAMA, StringComparison.Ordinal) ? word[..^1] + "ു" : null;

    /** N + a clitic, fused onto the last cardinal word through `stem`. */
    public static string CliticToWords(double n, string clitic, Func<string, string?> stem)
    {
        var words = NumberToWords(n).Split(' ');
        var last = words[^1];
        if (last.Length == 0) return "";
        var s = stem(last);
        if (s is null) return "";
        words[^1] = s + clitic;
        return string.Join(" ", words);
    }
}

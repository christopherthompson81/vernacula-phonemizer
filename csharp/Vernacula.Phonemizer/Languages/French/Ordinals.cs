/**
 * French (fr) ORDINALS — formation from any integer, plus the two written forms that reach the engine: digit
 * notation (`1er`, `1re`, `37e`, `2ème`) and the Roman-numeral century (`XVIIe siècle`).
 * Ported from src/languages/french/ordinals.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.French;

public static class Ordinals
{
    /** Magnitude words that carry a plural ⟨s⟩ in the cardinal but lose it before -ième. NOT a general
     *  "strip final s" rule — trois/six/dix keep theirs (troisième, sixième, dixième). */
    private static readonly IReadOnlySet<string> PLURAL_MAGNITUDES = new HashSet<string>(new[]
    {
        "vingts", "cents", "milliers", "millions", "milliards",
    }, StringComparer.Ordinal);

    /** Cardinal element → its -ième form (rules 1–4 above). */
    private static string ToIeme(string word)
    {
        var w = PLURAL_MAGNITUDES.Contains(word) ? word[..^1] : word;
        if (w == "un") return "unième"; // suppletive inside compounds: vingt-et-unième
        if (w == "cinq") return "cinquième";
        if (w == "neuf") return "neuvième";
        return (w.EndsWith("e", StringComparison.Ordinal) ? w[..^1] : w) + "ième";
    }

    private static readonly JsRe MILLION_IEME = JsRegex.Compile("^(million|milliard)ième$", "");

    /** Integer ≥ 1 → the French ordinal, in this language's own orthography, for the engine to phonemize. */
    public static string? Ordinal(double n, bool feminine = false, bool plural = false)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 1) return null;
        var s = plural ? "s" : "";
        if (n == 1) return (feminine ? "première" : "premier") + s;
        var words = Numbers.NumberToWords(n).Split(' ').ToList();
        var lastGroup = words[^1];
        words.RemoveAt(words.Count - 1);
        var parts = lastGroup.Split('-');
        parts[^1] = ToIeme(parts[^1]);
        var last = string.Join("-", parts);
        if (words.Count == 1 && words[0] == "un" && MILLION_IEME.IsMatch(last)) words.RemoveAt(words.Count - 1);
        return string.Join(" ", words.Append(last)) + s;
    }

    /** Feminine ordinal indicators: 1re / 1ère (and the common misspelling 1ere). */
    private static readonly JsRe FEMININE_SUFFIX = JsRegex.Compile("^(res?|ères?|eres?)$", "");

    /**
     * Suffix alternatives, LONGEST FIRST — JS alternation is leftmost-first, so `ers` must precede `er` or
     * `1ers` would read as `1er` followed by a stray s.
     */
    private const string SUFFIXES = "ers|er|res|re|ères|ère|eres|ere|èmes|ème|emes|eme|es|e|des|de|ds|d";

    /** French letters. */
    private const string L = "a-zà-ÿœæ";

    /** Digit ordinal notation → the spoken word. */
    private static readonly JsRe DIGIT_NOTATION = JsRegex.Compile($"(?<![{L}\\d])(\\d+)({SUFFIXES})(?![{L}\\d])", "gi");
    private static readonly JsRe HAS_DIGIT = JsRegex.Compile("\\d", "");
    private static readonly JsRe SECOND_SUFFIX = JsRegex.Compile("^(d|ds|de|des)$", "");

    public static string NormalizeFrenchOrdinalDigits(string text)
    {
        if (!HAS_DIGIT.IsMatch(text)) return text;
        return Rewrite(text, DIGIT_NOTATION, m =>
        {
            var digits = m.Groups[1].Value;
            var n = Js.Number(digits);
            var suf = m.Groups[2].Value.ToLowerInvariant();
            var plural = suf.EndsWith("s", StringComparison.Ordinal);
            if (SECOND_SUFFIX.IsMatch(suf))
            {
                if (n != 2) return m.Value;
                return (suf.StartsWith("de", StringComparison.Ordinal) ? "seconde" : "second") + (plural ? "s" : "");
            }
            return Ordinal(n, feminine: FEMININE_SUFFIX.IsMatch(suf), plural: plural) ?? m.Value;
        });
    }

    /** Roman ordinals absent from Lexique, so the lexicon filter cannot catch them: the abbreviation Cie
     *  (compagnie) and two rare verb forms that decode as numerals (cive/CIV, clive/CLIV). */
    private static readonly IReadOnlySet<string> ROMAN_WORD_STOPLIST =
        new HashSet<string>(new[] { "cie", "cies", "cive", "cives", "clive", "clives" }, StringComparer.Ordinal);

    /** Roman numeral + an ordinal suffix: XVIIe, XVIIème, IIe, Ve. Same explicit boundaries as above — this
     *  is the pattern that `siècle` tripped, since `cle` parses as CL + the -e suffix. */
    private static readonly JsRe ROMAN_NOTATION = JsRegex.Compile($"(?<![{L}\\d])([ivxlcdm]+)({SUFFIXES})(?![{L}\\d])", "gi");
    private static readonly JsRe HAS_ROMAN = JsRegex.Compile("[ivxlcdm]", "i");

    /** Roman-numeral ordinals → the spoken ordinal word. */
    public static string NormalizeFrenchOrdinalRomans(string text, Func<string, bool> isWord)
    {
        if (!HAS_ROMAN.IsMatch(text)) return text;
        return Rewrite(text, ROMAN_NOTATION, m =>
        {
            var lower = m.Value.ToLowerInvariant();
            if (isWord(lower) || ROMAN_WORD_STOPLIST.Contains(lower)) return m.Value;
            var n = Roman.RomanToInt(m.Groups[1].Value);
            if (n is null) return m.Value;
            var suf = m.Groups[2].Value.ToLowerInvariant();
            return Ordinal(n.Value, feminine: FEMININE_SUFFIX.IsMatch(suf),
                plural: suf.EndsWith("s", StringComparison.Ordinal)) ?? m.Value;
        });
    }
}

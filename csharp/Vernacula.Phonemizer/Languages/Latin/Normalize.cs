/**
 * Latin (la) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * Ported from src/languages/latin/normalize.ts, whose header carries the la.wikipedia corpus counts behind
 * every rule, the `&nbsp;`-as-thousands-separator finding, the whole-number de-grouping argument, and the
 * two REFUSALS this file inherits — the Roman ordinal (Latin ordinals decline for five cases × three
 * genders, and `libri III` is a cardinal) and the arithmetic signs. Nothing is re-derived here.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Latin;

public static class Normalize
{
    // ⚠ NEVER `\b` here even though Latin is ASCII-adjacent: the alphabet carries macrons and diaereses,
    // which `\b` treats as boundaries and would cut a word in half.
    private static readonly JsRe SPACE_GROUP = JsRegex.Compile(
        "(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:[ \\u00a0\\u202f\\u2009]\\d{3})+)(?!\\d)", "gu");  // space, NBSP, NNBSP, thin space
    private static readonly JsRe SPACE_SEPS = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");  // space, NBSP, NNBSP, thin space

    /** The clause tail that keeps the era marker's final dot — a sentence end, bare or behind a closer. */
    private static readonly JsRe SENTENCE_TAIL = JsRegex.Compile("^\\s*[\"»)']?\\s*$", "u");

    // ⚠ THE LONGER FORM FIRST, or the two-letter rule eats its prefix and strands the `n.`.
    private static readonly (JsRe Re, string Word)[] MULTI =
    [
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}a\\s?\\.\\s?C\\s?\\.\\s?n\\s?\\.", "gu"), "ante Christum natum"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}p\\s?\\.\\s?C\\s?\\.\\s?n\\s?\\.", "gu"), "post Christum natum"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}a\\s?\\.\\s?C\\s?\\.{Boundaries.NOT_LETTER_AFTER}", "gu"), "ante Christum"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}p\\s?\\.\\s?C\\s?\\.{Boundaries.NOT_LETTER_AFTER}", "gu"), "post Christum"),
    ];

    private static readonly JsRe ET_CETERA = JsRegex.Compile("&\\s?c\\s?\\.", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?°\\s?F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d)\\s?°(?!\\s*gradus)", "gu");
    private static readonly JsRe DEG_BEFORE_WORD = JsRegex.Compile("(\\d)\\s?°(?=\\s*gradus)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|(?<!\\d)[\\s(])[-−–]\\s?(\\d)", "gu");
    private static readonly JsRe DASH_RANGE = JsRegex.Compile("(\\d)\\s?[–—]\\s?(?=\\d)", "gu");
    private static readonly JsRe HYPHEN_RANGE = JsRegex.Compile(
        "(?<![\\d.,-])(\\d+)\\s?-\\s?(\\d+)(?!\\d)(?!\\s?-\\s?\\d)", "gu");
    private static readonly JsRe MULTI_SPACE = JsRegex.Compile("[^\\S\\n]{2,}", "gu");

    /** Normalize one Latin input string. Pure text→text. Steps are ORDER-DEPENDENT. */
    public static string NormalizeLatin(string input)
    {
        var s = Unicode.FoldNativeDigits(input);

        // 1) DE-GROUPING — the WHOLE number at once, not one two-digit join per pass.
        s = SPACE_GROUP.Replace(s, m => m.Groups[1].Value + SPACE_SEPS.Replace(m.Groups[2].Value, ""));
        s = SPACE_SEPS.Replace(s, " ");

        // 2) THE ERA MARKER — `a.C.n.` / `p.C.n.` and the two-letter forms.
        foreach (var (re, word) in MULTI)
        {
            var frozen = s;
            s = re.Replace(s, m =>
            {
                var rest = frozen[(m.Index + m.Value.Length)..];
                return SENTENCE_TAIL.IsMatch(rest) ? $"{word}." : word;
            });
        }

        // 3) `&c.` — the ligature of *et* and *c(etera)*.
        s = ET_CETERA.Replace(s, "et cetera");

        // 4) DEGREES — the scale letter claimed first, then the bare sign.
        s = DEG_C.Replace(s, "$1 gradus Celsius");
        s = DEG_F.Replace(s, "$1 gradus Fahrenheit");
        s = DEG.Replace(s, "$1 gradus ");
        s = DEG_BEFORE_WORD.Replace(s, "$1 ");

        // 5) SIGNS — the minus inverts and is read; the plus is not.
        s = MINUS.Replace(s, "$1minus $2");

        // 6) RANGES — the dash is spent on a PAUSE, and an ISBN is not a range.
        s = DASH_RANGE.Replace(s, "$1, ");
        s = HYPHEN_RANGE.Replace(s, "$1, $2");

        return MULTI_SPACE.Replace(s, " ");
    }
}

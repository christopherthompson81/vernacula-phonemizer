/**
 * Papiamento (pap) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/papiamento/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Papiamento;

public static class Normalize
{
    /**
     * ⚠ NEVER `\b` — Papiamento carries `á é í ó ú ñ ò è ù`, which `\b` treats as boundaries (trap 1/23).
     */

    // ── 1. THE SEPARATORS. ⚠ THE SAME TEST IS RUN ON BOTH MARKS: each of `.` and `,` both groups and
    //    decimates in this corpus, so the codepoint settles nothing and the three-digit test settles
    //    everything. THE WHOLE NUMBER AT ONCE; the trailing guard rejects a DIGIT and nothing else. ──
    // space, NBSP, NNBSP, thin space
    private static readonly JsRe SPACE_GROUP = JsRegex.Compile(
        "(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:[ \\u00a0\\u202f\\u2009]\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe SPACE_SEPS = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu"); // space, NBSP, NNBSP, thin space
    private static readonly JsRe DOT_GROUP = JsRegex.Compile(
        "(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:\\.\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe COMMA_GROUP = JsRegex.Compile(
        "(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:,\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    // …and what is left with one or two digits after a DOT is a decimal, folded onto the comma.
    private static readonly JsRe DOT_DECIMAL = JsRegex.Compile("(?<!\\d)(\\d+)\\.(\\d{1,2})(?!\\d)", "gu");

    // ── 2. THE ERA MARKER, in the Aruban spelling the corpus writes. The final dot is kept at a
    //    sentence end (trap 10). ──
    private static readonly List<(JsRe Re, string Word)> MULTI = new()
    {
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}a\\s?\\.\\s?C\\s?\\.", "gu"), "antes di Cristo"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}d\\s?\\.\\s?C\\s?\\.", "gu"), "despues di Cristo"),
    };
    private static readonly JsRe SENTENCE_TAIL = JsRegex.Compile("^\\s*[\"»)']?\\s*$", "u");

    // ── 3. SIGNS, before the range rule spends the hyphen. ──
    private static readonly JsRe MINUS = JsRegex.Compile("(^|(?<!\\d)[\\s(])[-−–]\\s?(\\d)", "gu");

    // ── 4. DEGREES — the coordinates, the interior angle and the temperatures. ──
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?°\\s?F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_MIN = JsRegex.Compile("(\\d)\\s?°\\s?(\\d+)\\s?[′']", "gu");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d)\\s?°", "gu");

    // ── 5. RANGES. The dash is spent on a pause rather than a connective; NOTHING MAY BE REQUIRED
    //    AFTER THE SECOND NUMBER (trap 58), and a chain of three or more groups is an identifier. ──
    private static readonly JsRe DASH_RANGE = JsRegex.Compile("(\\d)\\s?[–—]\\s?(?=\\d)", "gu");
    private static readonly JsRe HYPHEN_RANGE = JsRegex.Compile(
        "(?<![\\d.,\\-\\/])(\\d+)\\s?-\\s?(\\d+)(?![\\d\\/])(?!\\s?-\\s?\\d)", "gu");

    private static readonly JsRe MULTI_SPACE = JsRegex.Compile("[^\\S\\n]{2,}", "gu");

    /** Normalize one Papiamento input string. Pure text→text. Steps are ORDER-DEPENDENT. */
    public static string NormalizePapiamento(string input)
    {
        var s = input;

        // 1) THE SEPARATORS — one join over the whole grouped number per mark, then the decimal fold.
        s = Rewrite(s, SPACE_GROUP, m => m.Groups[1].Value + SPACE_SEPS.Replace(m.Groups[2].Value, ""));
        s = Rewrite(s, DOT_GROUP, m => m.Groups[1].Value + DOTS.Replace(m.Groups[2].Value, ""));
        s = Rewrite(s, COMMA_GROUP, m => m.Groups[1].Value + COMMAS.Replace(m.Groups[2].Value, ""));
        s = Rewrite(s, DOT_DECIMAL, "$1,$2");

        // 2) THE ERA MARKER. ⚠ THE JS REPLACE CALLBACK RECEIVES (match, offset, FULL STRING); the C#
        //    evaluator gets neither, so the pre-rewrite string is captured for the tail test.
        foreach (var (re, word) in MULTI)
        {
            var frozen = s;
            s = Rewrite(s, re, m =>
            {
                var rest = frozen[(m.Index + m.Value.Length)..];
                return SENTENCE_TAIL.IsMatch(rest) ? $"{word}." : word;
            });
        }

        // 3) SIGNS.
        s = Rewrite(s, MINUS, "$1menos $2");

        // 4) DEGREES.
        s = Rewrite(s, DEG_C, "$1 grado Celsius");
        s = Rewrite(s, DEG_F, "$1 grado Fahrenheit");
        s = Rewrite(s, DEG_MIN, "$1 grado $2 minüt ");
        s = Rewrite(s, DEG, "$1 grado ");

        // 5) RANGES.
        s = Rewrite(s, DASH_RANGE, "$1, ");
        s = Rewrite(s, HYPHEN_RANGE, "$1, $2");

        // A padded replacement doubles a space that was already there; collapse the runs.
        return Rewrite(s, MULTI_SPACE, " ");
    }
}

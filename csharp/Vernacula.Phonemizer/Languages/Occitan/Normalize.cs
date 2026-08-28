/**
 * Occitan (oc) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks.
 * Ported from src/languages/occitan/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Occitan;

public static class Normalize
{
    // ⚠ NEVER `\b` — Occitan carries `à è ò ó ç ï ú` and the interpunct, which `\b` treats as boundaries.
    private static readonly JsRe SPACE_GROUP = JsRegex.Compile(
        "(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:[ \\u00a0\\u202f\\u2009]\\d{3})+)(?!\\d)", "gu");  // space, NBSP, NNBSP, thin space
    private static readonly JsRe GROUP_SEPS = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");  // space, NBSP, NNBSP, thin space
    private static readonly JsRe DOT_DECIMAL = JsRegex.Compile("(?<!\\d)(\\d+)\\.(\\d+)(?!\\d)", "gu");
    private static readonly JsRe ERA_BC = JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}a[bv]\\.?\\s?C\\.?{Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe ERA_AD = JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}ap\\.?\\s?C\\.?{Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(?<![\\d:.,])([01]?\\d|2[0-4]):([0-5]\\d)(?![\\d:.,])", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|(?<!\\d)[\\s(])[-−–]\\s?(\\d)", "gu");
    private static readonly JsRe DEG_SCALE = JsRegex.Compile("(?<!in-\\d{0,3})(\\d)\\s?°\\s?([CF])(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_MIN = JsRegex.Compile("(?<!in-\\d{0,3})(\\d)\\s?°\\s?(\\d+)\\s?[′']", "gu");
    private static readonly JsRe DEG = JsRegex.Compile("(?<!in-\\d{0,3})(\\d)\\s?°", "gu");
    private static readonly JsRe DASH_RANGE = JsRegex.Compile("(\\d)\\s?[–—]\\s?(?=\\d)", "gu");
    private static readonly JsRe HYPHEN_RANGE = JsRegex.Compile(
        "(?<![\\d.,\\-\\/])(\\d+)\\s?-\\s?(\\d+)(?![\\d\\/])(?!\\s?-\\s?\\d)", "gu");
    private static readonly JsRe MULTI_SPACE = JsRegex.Compile("[^\\S\\n]{2,}", "gu");

    /** Normalize one Occitan input string. Pure text→text. Steps are ORDER-DEPENDENT. */
    public static string NormalizeOccitan(string input)
    {
        var s = input;

        s = Rewrite(s, SPACE_GROUP, m => m.Groups[1].Value + GROUP_SEPS.Replace(m.Groups[2].Value, ""));
        // ⚠ The DOT DECIMAL FOLDS ONTO THE COMMA unconditionally: no dot ever GROUPS in Occitan, so the
        // three-digit test a dot-grouping language needs would be wrong here.
        s = Rewrite(s, DOT_DECIMAL, "$1,$2");

        s = Rewrite(s, ERA_BC, "abans Crist");
        s = Rewrite(s, ERA_AD, "après Crist");

        s = Rewrite(s, CLOCK, "$1 $2");

        // ⚠ ORDER IS LOAD-BEARING: the sign must be claimed before the range rules below spend the hyphen.
        s = Rewrite(s, MINUS, "$1mens $2");

        // ⚠ The `(?<!in-\d{0,3})` lookbehind is not decorative and must span the WHOLE figure: `2 in-12°` is
        // DUODECIMO, a book size, and a fixed-width `(?<!in-)` passes on it and reads twelve degrees.
        s = Rewrite(s, DEG_SCALE, m =>
            $"{m.Groups[1].Value} graus {(m.Groups[2].Value.ToUpperInvariant() == "C" ? "Celsius" : "Fahrenheit")}");
        s = Rewrite(s, DEG_MIN, "$1 graus $2 minutas ");
        s = Rewrite(s, DEG, "$1 graus ");

        // A range's dash is spent on a PAUSE, not a connective: Occitan writes `entre X e Y` in full where it
        // means it, so imposing a connective would double a word the writer may already have chosen.
        s = Rewrite(s, DASH_RANGE, "$1, ");
        s = Rewrite(s, HYPHEN_RANGE, "$1, $2");

        return Rewrite(s, MULTI_SPACE, " ");
    }
}

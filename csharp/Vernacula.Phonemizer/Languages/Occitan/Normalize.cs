/**
 * Occitan (oc) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks.
 * Ported from src/languages/occitan/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Occitan;

public static class Normalize
{
    // ⚠ NEVER `\b` — Occitan carries `à è ò ó ç ï ú` and the interpunct, which `\b` treats as boundaries.
    private static readonly JsRe SPACE_GROUP = JsRegex.Compile(
        "(?<!\\d)(?<![\\d][.,])(\\d{1,3})((?:[    ]\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe GROUP_SEPS = JsRegex.Compile("[    ]", "gu");
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

        s = SPACE_GROUP.Replace(s, m => m.Groups[1].Value + GROUP_SEPS.Replace(m.Groups[2].Value, ""));
        // ⚠ The DOT DECIMAL FOLDS ONTO THE COMMA unconditionally: no dot ever GROUPS in Occitan, so the
        // three-digit test a dot-grouping language needs would be wrong here.
        s = DOT_DECIMAL.Replace(s, "$1,$2");

        s = ERA_BC.Replace(s, "abans Crist");
        s = ERA_AD.Replace(s, "après Crist");

        s = CLOCK.Replace(s, "$1 $2");

        // ⚠ ORDER IS LOAD-BEARING: the sign must be claimed before the range rules below spend the hyphen.
        s = MINUS.Replace(s, "$1mens $2");

        // ⚠ The `(?<!in-\d{0,3})` lookbehind is not decorative and must span the WHOLE figure: `2 in-12°` is
        // DUODECIMO, a book size, and a fixed-width `(?<!in-)` passes on it and reads twelve degrees.
        s = DEG_SCALE.Replace(s, m =>
            $"{m.Groups[1].Value} graus {(m.Groups[2].Value.ToUpperInvariant() == "C" ? "Celsius" : "Fahrenheit")}");
        s = DEG_MIN.Replace(s, "$1 graus $2 minutas ");
        s = DEG.Replace(s, "$1 graus ");

        // A range's dash is spent on a PAUSE, not a connective: Occitan writes `entre X e Y` in full where it
        // means it, so imposing a connective would double a word the writer may already have chosen.
        s = DASH_RANGE.Replace(s, "$1, ");
        s = HYPHEN_RANGE.Replace(s, "$1, $2");

        return MULTI_SPACE.Replace(s, " ");
    }
}

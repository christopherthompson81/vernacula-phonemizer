/**
 * Classical Nahuatl (nci) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/nahuatl/normalize.ts — see that file for the corpus evidence, and for why this
 * layer declares no shared symbol tier and refuses the plus, the percent, the currency and the minus.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Nahuatl;

public static class Normalize
{
    /** Units this layer reads — the two the shared tier cannot, because the tier matches `(NUM)\s?(unit)`
     *  with an OPTIONAL space and this corpus's false metres are all glued. */
    private static readonly (string Abbr, string Word)[] UNITS =
    {
        ("km", "kilómetros"),
        ("m", "metros"),
    };

    // ZWSP, BOM.
    private static readonly JsRe ZERO_WIDTH = JsRegex.Compile("[\\u200B\\uFEFF]", "gu");
    private static readonly JsRe NBSP_ENTITY = JsRegex.Compile("&nbsp;", "gu");
    // Space, NBSP, NNBSP, thin space — the four the corpus writes as grouping marks.
    private static readonly JsRe SPACE_GROUP = JsRegex.Compile(
        "(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:[ \\u00a0\\u202f\\u2009]\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe SPACE_CLASS = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");
    private static readonly JsRe COMMA_GROUP = JsRegex.Compile(
        "(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:,\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe COMMA = JsRegex.Compile(",", "gu");
    private static readonly JsRe DECIMAL = JsRegex.Compile("(?<![\\d.])(\\d+)\\.(\\d+)(?![\\d.])", "gu");
    private static readonly JsRe CLOCK_HMS = JsRegex.Compile(
        "(?<![\\d:.,])([01]?\\d|2[0-3]):([0-5]\\d):([0-5]\\d)(?![\\d:.,])", "gu");
    private static readonly JsRe CLOCK_HRS = JsRegex.Compile(
        $"(?<![\\d:.,])([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:.,])(\\s?)hrs{Boundaries.NOT_LETTER_AFTER}", "gu");
    // `°` U+00B0 ONLY — `º` U+00BA is the Spanish ordinal in this corpus.
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d)\\s?°", "gu");
    // `–` U+2013, `—` U+2014.
    private static readonly JsRe DASH_RANGE = JsRegex.Compile("(\\d)\\s?[–—]\\s?(?=\\d)", "gu");
    private static readonly JsRe HYPHEN_RANGE = JsRegex.Compile(
        "(?<![\\d.,\\-\\/])(\\d+)\\s?-\\s?(\\d+)(?![\\d\\/])(?!\\s?-\\s?\\d)", "gu");
    private static readonly JsRe WS_RUN = JsRegex.Compile("[^\\S\\n]{2,}", "gu");

    /** Normalize one Classical Nahuatl input string. Pure text→text; steps are ORDER-DEPENDENT. */
    public static string NormalizeNahuatl(string input)
    {
        var s = input;

        // 1) ZERO-WIDTH STRIP. Invisible, so it can only ever be noise; ZWJ/ZWNJ are NOT touched.
        s = Rewrite(s, ZERO_WIDTH, "");

        // 2) THE `&nbsp;` ENTITY, LITERAL. Replaced by a SPACE, not deleted — deleting fuses figure to unit.
        s = Rewrite(s, NBSP_ENTITY, " ");

        // 3) DE-GROUPING THE SPACE, BY THE THREE-DIGIT TEST — the whole number at once, one join per pass.
        s = Rewrite(s, SPACE_GROUP, m => m.Groups[1].Value + JsRegex.Replace(m.Groups[2].Value, SPACE_CLASS, ""));

        // 4) DE-GROUPING THE COMMA, same test.
        s = Rewrite(s, COMMA_GROUP, m => m.Groups[1].Value + JsRegex.Replace(m.Groups[2].Value, COMMA, ""));

        // 5) THE DECIMAL DOT, NEUTRALISED — no decimal word is sourceable, so the mark is spent rather
        //    than spoken; the guard keeps it off a dotted run of three or more groups.
        s = Rewrite(s, DECIMAL, "$1 $2");

        // 6) THE CLOCK, GATED ON ARITY AND ON THE MARKER WORD: `h:m:s` is claimed outright, the two-part
        //    form ONLY before `hrs`. The writer supplies the context word, so the figures stay FIGURES and
        //    only the colon is spent.
        s = Rewrite(s, CLOCK_HMS, "$1 $2 $3");
        //    …and `hrs` is expanded with it, or it reaches the g2p as *ɾs*. The TRAILING DOT IS NOT CONSUMED.
        s = Rewrite(s, CLOCK_HRS, "$1 $2$3horas");

        // 7) DEGREES. The scale letter class is `C` ALONE — `°F` is unattested here, and the scale letter
        //    is consumed unread rather than reaching the IPA as a stray [k].
        s = Rewrite(s, DEG_C, "$1 grados");
        s = Rewrite(s, DEG_BARE, "$1 grados ");

        // 8) THE TWO UNITS, WITH THE SPACE REQUIRED. `²³` and `/` are in the lookahead, so `km²` keeps its
        //    power visible and a rate is declined.
        foreach (var (abbr, word) in UNITS)
            s = Rewrite(s, JsRegex.Compile($"(\\d)\\s+{abbr}(?![\\p{{L}}\\p{{M}}\\d²³/])", "gu"), $"$1 {word}");

        // 9) RANGES. The dash is spent on a pause rather than a connective; nothing may be required after
        //    the second number, and an adjacent slash means a regnal alternative.
        s = Rewrite(s, DASH_RANGE, "$1, ");
        s = Rewrite(s, HYPHEN_RANGE, "$1, $2");

        // A padded replacement doubles a space that was already there.
        return Rewrite(s, WS_RUN, " ");
    }
}

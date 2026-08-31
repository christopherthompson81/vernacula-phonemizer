/**
 * Shan (shn) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/shan/normalize.ts — see that file for the corpus evidence (the separator
 * convention, the coordinate the corpus glosses both ways, and the four declined classes).
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Shan;

public static class Normalize
{
    private static readonly JsRe GROUPED = JsRegex.Compile(@"(?<!\d)(?<![\d][.,])([1-9]\d{0,2})((?:,\d{3})+)(?!\d)", "gu");
    private static readonly JsRe COMMA = JsRegex.Compile(",", "gu");
    private static readonly JsRe SPACES = JsRegex.Compile(@"[ \u00a0\u202f\u2009]", "gu");  // space, NBSP, NNBSP, thin space
    private static readonly JsRe ERA = JsRegex.Compile(
        @"(?<![\p{L}\p{M}])A\.?\s?D\.?" + Boundaries.NOT_LETTER_AFTER, "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile(
        @"(?<![\d:.,])([01]?\d|2[0-4]):([0-5]\d)(?![\d:.,])(?!\s*[မ][ူွ]င်း)", "gu");
    private static readonly JsRe CLOCK_GLOSSED = JsRegex.Compile(
        @"(?<![\d:.,])([01]?\d|2[0-4]):([0-5]\d)(?![\d:.,])(?=\s*[မ][ူွ]င်း)", "gu");
    private static readonly JsRe COORDINATE = JsRegex.Compile(@"(\d)\s?°\s?(\d+)\s?['′]", "gu");
    private static readonly JsRe DEGREE_SCALE = JsRegex.Compile(@"(\d)\s?°\s?[CF](?![\p{L}\p{M}])", "gui");
    private static readonly JsRe DEGREE = JsRegex.Compile(@"(\d)\s?°", "gu");
    private static readonly JsRe COUNTRY_CURRENCY = JsRegex.Compile(@"(?<![\p{L}\p{M}])(?:US|AU|CA|NZ|HK|SG)\s?(?=[$])", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile(@"\s?±\s?", "gu");
    private static readonly JsRe RANGE_DASH = JsRegex.Compile(@"(\d)\s?[–—]\s?(?=\d)", "gu");
    private static readonly JsRe RANGE_HYPHEN = JsRegex.Compile(@"(?<![\d.,])(\d+)\s?-\s?(?=\d)", "gu");
    private static readonly JsRe SLASH = JsRegex.Compile(@"(?<![\d.,])(\d+)\s?\/\s?(?=\d)", "gu");
    private static readonly JsRe DOUBLE_SPACE = JsRegex.Compile(@"[^\S\n]{2,}", "gu");

    /** Normalize one Shan input string. Pure text→text. Steps are ORDER-DEPENDENT. */
    public static string NormalizeShan(string input)
    {
        // ⚠ THIS LAYER FOLDS THE NATIVE DIGITS ITSELF — `Shan.Text` folds AFTER this pass, so a rule
        // written here against ASCII digits would never see `၉၂၄,၆၀၈`.
        var s = Unicode.FoldNativeDigits(input);

        // ⚠ THE WHOLE NUMBER IS MATCHED AT ONCE, not one join per pass — a repeated two-digit join is
        // correct to three groups and silently wrong at four. Two passes, because adjacent groups share
        // the digit the first consumes.
        s = Rewrite(s, GROUPED, m => m.Groups[1].Value + JsRegex.Replace(m.Groups[2].Value, COMMA, ""));
        s = Rewrite(s, SPACES, " ");

        s = Rewrite(s, ERA, "ပီၶရိတ်ႉ");

        s = Rewrite(s, CLOCK, m =>
            Js.Number(m.Groups[2].Value) == 0
                ? $"{m.Groups[1].Value} မူင်း"
                : $"{m.Groups[1].Value} မူင်း {m.Groups[2].Value} မိၼိတ်ႉ");
        s = Rewrite(s, CLOCK_GLOSSED, m =>
            Js.Number(m.Groups[2].Value) == 0
                ? $"{m.Groups[1].Value} "
                : $"{m.Groups[1].Value} မူင်း {m.Groups[2].Value} မိၼိတ်ႉ ");

        // ⚠ THE COORDINATE PAIR IS CLAIMED FIRST so the prime is not stranded once the degree rule has
        // spent the sign.
        s = Rewrite(s, COORDINATE, "$1 ၻီႇၵရီႇ $2 မိၼိတ်ႉ ");
        s = Rewrite(s, DEGREE_SCALE, "$1 ၻီႇၵရီႇ ");
        s = Rewrite(s, DEGREE, "$1 ၻီႇၵရီႇ ");

        s = Rewrite(s, COUNTRY_CURRENCY, "");
        s = Rewrite(s, PLUS_MINUS, ", ");

        s = Rewrite(s, RANGE_DASH, "$1, ");
        s = Rewrite(s, RANGE_HYPHEN, "$1, ");
        s = Rewrite(s, SLASH, "$1, ");

        return Rewrite(s, DOUBLE_SPACE, " ");
    }
}

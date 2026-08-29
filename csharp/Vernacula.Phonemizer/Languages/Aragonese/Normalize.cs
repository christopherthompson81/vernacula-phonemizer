/**
 * Aragonese (an) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/aragonese/normalize.ts — see that file for the corpus evidence.
 */

/** ⚠ NEVER `\b` — Aragonese carries `á é í ó ú ñ ü ï` and the interpunct, which `\b` treats as boundaries. */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Aragonese;

public static class Normalize
{
    /** ⚠ THE ALLOW-LISTED CONTINUATION IS THE WHOLE OF THE DEGREE RULE. The sign reads as a degree only
     *  before one of the shapes that actually follows a degree in this corpus; the lone ordinal
     *  (`57° país`) qualifies under none of them and falls through unread. The compass set is `NSEU`,
     *  not `NSEW` — Aragonese west is *ueste*. */
    private const string DEGREE_TAIL =
        "(?:\\s?[CF]|\\s?[NSEU](?![\\p{L}\\p{M}])|\\s?\\d+\\s?[′']"
        + "|\\s*(?:de|y|en)(?![\\p{L}\\p{M}])|\\s*[.,;:)(»]|\\s*$)";

    // Separators: space, NBSP, NNBSP, thin space.
    private static readonly JsRe SPACE_GROUP = JsRegex.Compile(
        "(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:[ \\u00a0\\u202f\\u2009]\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe SPACE_SEPS = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");  // space, NBSP, NNBSP, thin space
    private static readonly JsRe DOT_GROUP = JsRegex.Compile(
        "(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:\\.\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe DOT_DECIMAL = JsRegex.Compile("(?<!\\d)(\\d+)\\.(\\d+)(?!\\d)", "gu");
    private static readonly JsRe SENTENCE_TAIL = JsRegex.Compile("^\\s*[\"»)']?\\s*$", "u");
    private static readonly List<(JsRe Re, string Word)> MULTI = new()
    {
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}a\\s?\\.\\s?C\\s?\\.", "gu"), "antes de Cristo"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}d\\s?\\.\\s?C\\s?\\.", "gu"), "dimpués de Cristo"),
    };
    private static readonly JsRe NUMERO = JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}n\\s?[º°]\\s?\\.?(?=\\s*\\d)", "gu");
    private static readonly JsRe LUMERO = JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}lum\\s?\\.(?=\\s*\\d)", "gu");
    private static readonly JsRe HAB = JsRegex.Compile("(\\d)\\s?hab\\s?\\.\\s?(?=\\/)", "gu");
    private static readonly JsRe MAYA = JsRegex.Compile("(\\d)\\s?m\\s?\\.\\s?a\\s?\\.", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(?<![\\d:.,])([01]?\\d|2[0-4]):([0-5]\\d)(?![\\d:.,])", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|(?<!\\d)[\\s(])[-−–]\\s?(\\d(?!\\d*:))", "gu");
    private static readonly JsRe DEG_SCALE = JsRegex.Compile("(\\d)\\s?[°º]\\s?([CF])(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_MIN = JsRegex.Compile("(\\d)\\s?[°º]\\s?(\\d+)\\s?[′']", "gu");
    private static readonly IReadOnlyDictionary<string, string> COMPASS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["N"] = "norte", ["S"] = "sud", ["E"] = "este", ["U"] = "ueste",
    };
    private static readonly JsRe DEG_COMPASS = JsRegex.Compile("(\\d)\\s?[°º]\\s?([NSEU])(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DEG = JsRegex.Compile($"(\\d)\\s?[°º](?={DEGREE_TAIL})", "gu");
    private static readonly JsRe DASH_RANGE = JsRegex.Compile("(\\d)\\s?[–—]\\s?(?=\\d)", "gu");
    private static readonly JsRe HYPHEN_RANGE = JsRegex.Compile(
        "(?<![\\d.,\\-\\/])(\\d+)\\s?-\\s?(\\d+)(?![\\d\\/])(?!\\s?-\\s?\\d)", "gu");
    private static readonly JsRe MULTI_SPACE = JsRegex.Compile("[^\\S\\n]{2,}", "gu");

    /** Normalize one Aragonese input string. Pure text→text. Steps are ORDER-DEPENDENT. */
    public static string NormalizeAragonese(string input)
    {
        var s = input;

        // 1) SEPARATORS: the DOT groups and the COMMA decimates, the DOT also decimates under 3 digits,
        //    the SPACE groups too, and what is left carrying a dot is a decimal folded onto the comma.
        s = Rewrite(s, SPACE_GROUP, m => m.Groups[1].Value + SPACE_SEPS.Replace(m.Groups[2].Value, ""));
        s = Rewrite(s, DOT_GROUP, m => m.Groups[1].Value + DOTS.Replace(m.Groups[2].Value, ""));
        s = Rewrite(s, DOT_DECIMAL, "$1,$2");

        // 2) THE ERA MARKER. `a. C.` / `d. C.`; the final dot is kept at a sentence end.
        foreach (var (re, word) in MULTI)
        {
            var frozen = s;
            s = Rewrite(s, re, m =>
            {
                var rest = frozen[(m.Index + m.Value.Length)..];
                return SENTENCE_TAIL.IsMatch(rest) ? $"{word}." : word;
            });
        }

        // 3) THE ABBREVIATIONS. `nº` → numero, `lum.` → lumero, `hab.` loses its dot so the tier sees a rate,
        //    `m.a.` → millons d'anyadas (the tier would otherwise read its `m` as metres).
        s = Rewrite(s, NUMERO, "numero ");
        s = Rewrite(s, LUMERO, "lumero");
        s = Rewrite(s, HAB, "$1 hab");
        s = Rewrite(s, MAYA, "$1 millons d'anyadas");

        // 4) THE CLOCK. ⚠ THE GUARD IS THE RULE: a trailing `.dd` or a second colon is a stopwatch, not a time.
        s = Rewrite(s, CLOCK, "$1 $2");

        // 5) SIGNS, before the range rule spends the hyphen. `menos` inverts rather than pauses.
        s = Rewrite(s, MINUS, "$1menos $2");

        // 6) DEGREES. Both codepoints, one allow-list. `grau`/`graus`, the compass letter spelled,
        //    and the bare degree through DEGREE_TAIL.
        s = Rewrite(s, DEG_SCALE, m =>
            $"{m.Groups[1].Value} graus {(m.Groups[2].Value.ToUpperInvariant() == "C" ? "Celsius" : "Fahrenheit")}");
        s = Rewrite(s, DEG_MIN, "$1 graus $2 menutos ");
        s = Rewrite(s, DEG_COMPASS, m => $"{m.Groups[1].Value} graus {COMPASS[m.Groups[2].Value]}");
        s = Rewrite(s, DEG, "$1 graus ");

        // 7) RANGES. The dash is spent on a pause; nothing is required after the second number.
        s = Rewrite(s, DASH_RANGE, "$1, ");
        s = Rewrite(s, HYPHEN_RANGE, "$1, $2");

        // A padded replacement doubles a space that was already there; collapse the runs.
        return Rewrite(s, MULTI_SPACE, " ");
    }
}

/**
 * Aromanian (rup) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the pipeline speaks. Pure text→text, no IPA.
 *
 * The headline is in the TS header: ALL FOUR separator conventions are in use, and one sentence carries two
 * of them — the comma groups AND decimates, and the dot does both too — so the three-digit test is applied
 * symmetrically to both marks, the dotted date is taken first, the colon is never a clock, and the shared
 * symbol tier sees the number still adjacent to its unit (which is why the separators run before it and the
 * range rule runs after it).
 * Ported from src/languages/aromanian/normalize.ts — see that file for the corpus evidence.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Aromanian;

public static class Normalize
{
    /**
     * The shared symbol tier. `la sutã` is the corpus's own gloss of the percent sign; `metru`, `kilometru`
     * and `hectar` are the declared units; `shi` the ampersand; the magnitudes are the compositor's own
     * words. No `exponentWords` (both candidate words are ×0 on this corpus) and no `currency` (the currency
     * cell mined empty).
     */
    private static readonly Func<string, string> SYMBOLS =
        NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
        {
            Percent = new[] { "la sutã" },
            Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
            {
                ["km"] = new[] { "kilometru" },
                ["m"] = new[] { "metru" },
                ["ha"] = new[] { "hectar" },
            },
            Ampersand = "shi",
            Magnitudes = new[] { "milion", "milioani", "miliardzã" },
        });

    /** 1) THE DOTTED DATE, FIRST — three dot-joined runs, the second with two digits, which the decimal arm
     *  would claim. The dots become spaces; no date vocabulary is invented. */
    private static readonly JsRe DOTTED_DATE =
        JsRegex.Compile("(?<![\\d.])(\\d{1,4})((?:\\.\\d{1,4}){2,})(?!\\d)(?!\\.\\d)", "gu");
    private static readonly JsRe DOT = JsRegex.Compile("\\.", "gu");

    /** 2) THE SEPARATORS — the same three-digit test on both marks, because each does both jobs. */
    private static readonly JsRe GROUP_SEPARATED =
        JsRegex.Compile("(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:[.,]\\d{3})+)(?!\\d)(?![.,]\\d)", "gu");
    private static readonly JsRe GROUP_SEPS = JsRegex.Compile("[.,]", "gu");
    /** The space groups too — ⚠ the separators spelled as escapes, not typed (the nso lesson). */
    private static readonly JsRe GROUP_SPACE =
        JsRegex.Compile("(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:[ \\u00a0\\u202f\\u2009]\\d{3})+)(?!\\d)(?![.,]\\d)", "gu");
    private static readonly JsRe SPACE_SEPS = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");
    /** What is left with one or two digits is a decimal, spent rather than spoken: no decimal-point word is
     *  attested, so the mark becomes a space. */
    private static readonly JsRe DECIMAL =
        JsRegex.Compile("(?<![\\d.,])(\\d+)[.,](\\d{1,2})(?!\\d)(?![.,]\\d)", "gu");

    /** 3) THE EN/EM DASH SPAN, BEFORE THE ERA STEP — the character to the left of the dash is the
     *  abbreviation's dot, not a digit, and matching it while the dot is still there is what claims it. */
    private static readonly JsRe DASH_SPAN =
        JsRegex.Compile("([.\\d])\\s?[\\u2013\\u2014]\\s?(?=\\d)", "gu");

    /** 3) THE ERA MARKERS, both spacings the corpus uses. The expansions are quoted, not constructed. */
    private static readonly JsRe ERA_N =
        JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}n\\s?\\.\\s?Hr\\s?\\.", "gu");
    private static readonly JsRe ERA_D =
        JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}d\\s?\\.\\s?Hr\\s?\\.", "gu");
    /** The final dot is kept at a sentence end, or the pause is lost outright. */
    private static readonly JsRe SENTENCE_END =
        JsRegex.Compile("^\\s*[\"\\u00bb\\u201d\\u2019]?\\s*$", "u");

    private static string EraOrAbbrev(Match m, string full, string word)
    {
        var rest = full[(m.Index + m.Length)..];
        return SENTENCE_END.IsMatch(rest) ? $"{word}." : word;
    }

    /** 4) THE DOTTED ABBREVIATIONS, and the guard is a sentence end, not a following word — the corpus's
     *  commonest instance has a bracket after the dot. */
    private static readonly JsRe ABBREV_BAN =
        JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}bãn\\s?\\.", "gu");
    private static readonly JsRe ABBREV_NR =
        JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}nr\\s?\\.", "gu");
    private static readonly JsRe ABBREV_GR =
        JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}gr\\s?\\.", "gu");
    private static readonly JsRe ABBREV_DR =
        JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}dr\\s?\\.", "gu");

    /** 5) THE NUMERAL PARTICLE `di` sits between the figure and the unit; the tier's adjacency requirement
     *  cannot bridge it, so the unit is expanded here. */
    private static readonly JsRe DI_KM =
        JsRegex.Compile("(\\d+\\s+di\\s+)km" + Boundaries.NOT_LETTER_AFTER, "gu");

    /** 7) RANGES — all three dashes do it here, which is why the class is `[-–—]`; the dash is spent on a
     *  pause rather than a connective, and an adjacent slash is a legal citation, not a span. */
    private static readonly JsRe RANGE =
        JsRegex.Compile("(?<![\\d.,\\-\\/])(\\d+)\\s?-\\s?(\\d+)(?![\\d\\/])(?!\\s?-\\s?\\d)", "gu");

    private static readonly JsRe WS_RUN = JsRegex.Compile("[^\\S\\n]{2,}", "gu");

    /** Normalize one Aromanian input string. Pure text→text. Steps are order-dependent. */
    public static string NormalizeAromanian(string input)
    {
        var s = input;

        // 1) The dotted date, first.
        s = Rewrite(s, DOTTED_DATE, m => m.Groups[1].Value + DOT.Replace(m.Groups[2].Value, " "));

        // 2) The separators — the whole number at once, not one join per pass.
        s = Rewrite(s, GROUP_SEPARATED, m => m.Groups[1].Value + GROUP_SEPS.Replace(m.Groups[2].Value, ""));
        s = Rewrite(s, GROUP_SPACE, m => m.Groups[1].Value + SPACE_SEPS.Replace(m.Groups[2].Value, ""));
        s = Rewrite(s, DECIMAL, "$1 $2");

        // 3) The en/em dash span, before the era step — the ordering is the point.
        s = Rewrite(s, DASH_SPAN, "$1, ");
        s = Rewrite(s, ERA_N, m => EraOrAbbrev(m, s, "ninti di Hristo"));
        s = Rewrite(s, ERA_D, m => EraOrAbbrev(m, s, "dupu Hristo"));

        // 4) The dotted abbreviations.
        s = Rewrite(s, ABBREV_BAN, m => EraOrAbbrev(m, s, "bãnãtori"));
        s = Rewrite(s, ABBREV_NR, m => EraOrAbbrev(m, s, "numir"));
        s = Rewrite(s, ABBREV_GR, m => EraOrAbbrev(m, s, "grãtseascã"));
        s = Rewrite(s, ABBREV_DR, m => EraOrAbbrev(m, s, "doctor"));

        // 5) The `di` particle between figure and unit.
        s = Rewrite(s, DI_KM, "$1kilometru");

        // 6) The shared symbol tier — % and the units; it must see the number still adjacent to its unit.
        s = SYMBOLS(s);

        // 7) Ranges.
        s = Rewrite(s, RANGE, "$1, $2");

        // A padded replacement doubles a space that was already there; a plain replace, not the seam —
        // the TS uses String.replace here.
        return WS_RUN.Replace(s, " ");
    }
}

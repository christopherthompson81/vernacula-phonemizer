/**
 * Faroese (fo) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * The full stop does FIVE jobs in this corpus (time, thousands group, decimal, ordinal marker, sentence
 * end) and they are resolved from the most constrained shape to the least; the comma is the decimal, so
 * the dot-decimals are folded onto it; the ordinal word is REFUSED and only the false break is fixed;
 * the colon is NOT a clock (it is a national swimming record).
 * Ported from src/languages/faroese/normalize.ts — see that file for the corpus evidence and the sourcing.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Faroese;

public static class Normalize
{
    // ───────────────────────────────────────────────────────────────────────────────────────────────
    // The rules — ⚠ EVERY BOUNDARY IS AN EXPLICIT LOOKAROUND, NEVER `\b`
    // ───────────────────────────────────────────────────────────────────────────────────────────────

    /** 1) THE TIME — the only shape with TWO dots, resolved first or the grouping rule takes its first pair. */
    private static readonly JsRe TIME = JsRegex.Compile(
        "(?<![\\d.,])([01]?\\d|2[0-4])\\.([0-5]\\d)\\.([0-5]\\d|60)(?![\\d.,])", "gu");

    /** 2) THE THOUSANDS GROUP — the no-break spaces this corpus uses alongside the dot. */
    private static readonly JsRe GROUPED_SPACE = JsRegex.Compile(
        "(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:[ \\u00a0\\u202f\\u2009]\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe GROUPED_DOT = JsRegex.Compile(
        "(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:\\.\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe SPACE_SEPS = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu"); // space, NBSP, NNBSP, thin space
    private static readonly JsRe DOT_SEPS = JsRegex.Compile("\\.", "gu");

    /** 3) THE DECIMAL DOT — what is left with fewer than three digits after it; folded onto the comma. */
    private static readonly JsRe DECIMAL_DOT = JsRegex.Compile("(?<!\\d)(\\d+)\\.(\\d{1,2})(?!\\d)", "gu");

    /** 4) THE ABBREVIATIONS — every expansion the corpus's own; the trailing-dot guard keeps a sentence end. */
    private static readonly (JsRe Re, string Word)[] ABBREV =
    {
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}n\\s?\\.\\s?br\\s?\\.", "gu"), "norðurbreidd"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}v\\s?\\.\\s?l\\s?\\.", "gu"), "vesturlongd"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}f\\s?\\.\\s?Kr\\s?\\.", "gu"), "fyri Kristus"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}e\\s?\\.\\s?Kr\\s?\\.", "gu"), "eftir Kristus"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}e\\s?\\.\\s?m\\s?\\.", "gu"), "eftir middag"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}f\\s?\\.\\s?m\\s?\\.", "gu"), "fyri middag"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}kl\\s?\\.", "gu"), "klokkan"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}mió\\s?\\.", "gu"), "milliónir"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}uml\\s?\\.", "gu"), "umleið"),
    };
    /** The ABBREV's sentence-end test: only whitespace and at most one closing quote/paren remain. */
    private static readonly JsRe ABBREV_SENTENCE_END = JsRegex.Compile("^[\\s*[\"»)']?\\s*$", "u");

    /** 5) THE ORDINAL PERIOD — the dot is spent and NO WORD IS EMITTED (the ordinal is refused; see the TS).
     *  The guard is a FOLLOWING LOWERCASE WORD: an uppercase one begins a new sentence. */
    private static readonly JsRe ORDINAL_PERIOD = JsRegex.Compile("(?<![\\d.,])(\\d{1,4})\\.(\\s+)(?=\\p{Ll})", "gu");
    /** …the same before a NO-BREAK SPACE, which must be the separator and nothing else (a plain space plus a
     *  bare `\\p{L}` lookahead ate the sentence-final dot in `Tað var 1998. Síðan kom`). */
    private static readonly JsRe ORDINAL_PERIOD_NBSP = JsRegex.Compile("(?<![\\d.,])(\\d{1,4})\\.(\\u00a0)(?=\\p{L})", "gu");

    /** 6) DEGREES — the angular instances are coordinates, the thermal ones carry the scale letter. */
    private static readonly JsRe DEG_CELSIUS = JsRegex.Compile("(\\d)\\s?°\\s?C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_FAHRENHEIT = JsRegex.Compile("(\\d)\\s?°\\s?F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d)\\s?°", "gu");

    /** 7) SIGNS, before the range rule spends the hyphen. */
    private static readonly JsRe MINUS = JsRegex.Compile("(^|(?<!\\d)[\\s(])[-\\u2212\\u2013]\\s?(\\d)", "gu");

    /** 8) RANGES — the dash is spent on a PAUSE rather than a connective, and NOTHING MAY BE REQUIRED AFTER
     *  THE SECOND NUMBER; a chain of three or more hyphen-joined groups is an identifier. */
    private static readonly JsRe DASH_RANGE = JsRegex.Compile("(\\d)\\s?[\\u2013\\u2014]\\s?(?=\\d)", "gu");
    private static readonly JsRe HYPHEN_RANGE = JsRegex.Compile(
        "(?<![\\d.,\\-\\/])(\\d+)\\s?-\\s?(\\d+)(?![\\d\\/])(?!\\s?-\\s?\\d)", "gu");

    private static readonly JsRe WS_RUN = JsRegex.Compile("[^\\S\\n]{2,}", "gu");

    /** Normalize one Faroese input string. Pure text→text. Steps are ORDER-DEPENDENT — the five jobs of the
     *  full stop are resolved from the most constrained shape to the least. */
    public static string NormalizeFaroese(string input)
    {
        var s = input;

        // 1) THE TIME, first — the only two-dot shape; the fields are separated and left as figures.
        s = Rewrite(s, TIME, "$1 $2 $3");

        // 2) THE THOUSANDS GROUP — the WHOLE NUMBER AT ONCE, and the trailing guard rejects a digit and nothing else.
        s = Rewrite(s, GROUPED_SPACE, m => m.Groups[1].Value + SPACE_SEPS.Replace(m.Groups[2].Value, ""));
        s = Rewrite(s, GROUPED_DOT, m => m.Groups[1].Value + DOT_SEPS.Replace(m.Groups[2].Value, ""));

        // 3) THE DECIMAL DOT — folded onto the comma the engine's number branch reads, so one branch
        //    covers both conventions.
        s = Rewrite(s, DECIMAL_DOT, "$1,$2");

        // 4) THE ABBREVIATIONS, before the ordinal rule spends any remaining dot. ⚠ THE FINAL DOT IS KEPT
        //    AT A SENTENCE END, or the pause is lost outright.
        foreach (var (re, word) in ABBREV)
            s = Rewrite(s, re, m =>
                ABBREV_SENTENCE_END.IsMatch(s[(m.Index + m.Value.Length)..]) ? word + "." : word);

        // 5) THE ORDINAL PERIOD — the dot is spent and the figure and its noun stay in one clause.
        s = Rewrite(s, ORDINAL_PERIOD, "$1$2");
        s = Rewrite(s, ORDINAL_PERIOD_NBSP, "$1$2");

        // 6) DEGREES.
        s = Rewrite(s, DEG_CELSIUS, "$1 stig Celsius");
        s = Rewrite(s, DEG_FAHRENHEIT, "$1 stig Fahrenheit");
        s = Rewrite(s, DEG_BARE, "$1 stig ");

        // 7) SIGNS.
        s = Rewrite(s, MINUS, "$1minus $2");

        // 8) RANGES.
        s = Rewrite(s, DASH_RANGE, "$1, ");
        s = Rewrite(s, HYPHEN_RANGE, "$1, $2");

        // A padded replacement doubles a space that was already there. Harmless downstream because
        // AssembleClauses collapses runs, but this pass should not be the one producing the candidates.
        return Rewrite(s, WS_RUN, " ");
    }
}

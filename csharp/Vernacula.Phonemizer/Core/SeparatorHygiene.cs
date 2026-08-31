/**
 * SEPARATOR HYGIENE — the part of text normalization that needs NO vocabulary, for the languages that have
 * no corpus to source vocabulary from.
 * Ported from src/core/separatorHygiene.ts — see that file for the corpus evidence.
 *
 * ⚠ THIS PASS EMITS NO WORDS, EVER. That is the whole design: it spends separators and nothing else, so it
 * cannot speak a word the language may not use. Do not add a rule that reads a sign or names a decimal
 * point here — a single ambiguous grouped run is likewise left alone rather than guessed at.
 */

using static Vernacula.Phonemizer.Core.Rewriter;
namespace Vernacula.Phonemizer.Core;

public static class SeparatorHygienePass
{
    /** Spend the separators that cannot be anything but separators. ⚠ THE ORDER IS THE ONLY ONE THAT
     *  COMPOSES: the multi-group join runs before the short-decimal rule, so `1.234.567` is one number
     *  before anything looks for a two-digit tail.
     *
     *  ⚠ EVERY TRAILING GUARD REJECTS A DIGIT, OR A MARK THAT CONTINUES THE NUMBER — never a bare clause
     *  mark. A plain `(?![\d.,])` declines `1.234.567.` outright, so a grouped figure at the end of a
     *  sentence keeps all of its false stops. */
    /** ASCII space, NBSP, NNBSP, thin space — written as ESCAPES, never literals. */
    private const string SP = "[ \\u00a0\\u202f\\u2009]";  // space, NBSP, NNBSP, thin space

    /**
     * ⚠ THE SPACE GROUP, WHICH WAS IN NEITHER THE RULES NOR THE REFUSALS (#1212). `1.234.567` was joined and
     * `1 000 000` was not, so the same quantity was fixed in the two conventions these languages do not use
     * and missed in the one several of them do — smj and kl are written in Nordic orthography, where the
     * SPACE is the standard thousands separator. Untouched it read *one zero zero*: a silent 1000× error,
     * precisely the class this pass exists to close.
     *
     * ⚠ ONE GROUP IS ENOUGH HERE, unlike the dot/comma rule. That rule needs TWO because `1.234` is
     * genuinely ambiguous between grouping and a three-place decimal; a SPACE is never a decimal separator
     * in any convention, so that ambiguity does not arise. The shape is Lithuanian's own de-grouping rule,
     * measured there over its corpus at 24 sites, all genuine, zero false positives.
     *
     * ⚠ BOTH GUARDS COME WITH IT: the right edge takes EXACTLY three digits, so a fourth disqualifies the
     * group and declines a bare pair like `21 2001` (a date); the left edge rejects a STANDALONE `0`, so
     * `0 000` is not welded into a figure nobody wrote.
     */
    private static readonly JsRe SPACE_GROUP =
        JsRegex.Compile($"(?<=\\d)(?<!(?<![\\d.,])0){SP}(?=\\d{{3}}(?!\\d))", "gu");

    public static string SeparatorHygiene(string input)
    {
        var s = input;

        // 0) THE SPACE GROUP — above everything, for the reason every de-grouping rule in this tree is
        //    first: the separator must stop being a boundary before any other rule reads the number around
        //    it. Iterated to a FIXED POINT, since one pass consumes only the first separator of a pair.
        for (var prev = ""; prev != s;)
        {
            prev = s;
            s = Rewrite(s, SPACE_GROUP, "");
        }

        s = Rewrite(s, JsRegex.Compile(@"(?<![\d.,])([1-9]\d{0,2})((?:[.,]\d{3}){2,})(?!\d)(?![.,]\d)", "gu"),
            m => m.Groups[1].Value + JsRegex.Compile("[.,]", "gu").Replace(m.Groups[2].Value, ""));

        s = Rewrite(s, JsRegex.Compile(@"(?<![\d.,])(\d+)[.,](\d{1,2})(?!\d)(?![.,]\d)", "gu"), "$1 $2");

        s = Rewrite(s, JsRegex.Compile(@"(?<![\d.])(\d{1,4})((?:\.\d{1,4}){2,})(?!\d)(?!\.\d)", "gu"),
            m => m.Groups[1].Value + JsRegex.Compile(@"\.", "gu").Replace(m.Groups[2].Value, " "));

        s = Rewrite(s, JsRegex.Compile(@"(\d)\s?[–—]\s?(?=\d)", "gu"), "$1, ");

        return s;
    }
}

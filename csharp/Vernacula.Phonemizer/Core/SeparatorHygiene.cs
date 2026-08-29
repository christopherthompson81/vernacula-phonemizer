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
    public static string SeparatorHygiene(string input)
    {
        var s = input;

        s = Rewrite(s, JsRegex.Compile(@"(?<![\d.,])([1-9]\d{0,2})((?:[.,]\d{3}){2,})(?!\d)(?![.,]\d)", "gu"),
            m => m.Groups[1].Value + JsRegex.Compile("[.,]", "gu").Replace(m.Groups[2].Value, ""));

        s = Rewrite(s, JsRegex.Compile(@"(?<![\d.,])(\d+)[.,](\d{1,2})(?!\d)(?![.,]\d)", "gu"), "$1 $2");

        s = Rewrite(s, JsRegex.Compile(@"(?<![\d.])(\d{1,4})((?:\.\d{1,4}){2,})(?!\d)(?!\.\d)", "gu"),
            m => m.Groups[1].Value + JsRegex.Compile(@"\.", "gu").Replace(m.Groups[2].Value, " "));

        s = Rewrite(s, JsRegex.Compile(@"(\d)\s?[–—]\s?(?=\d)", "gu"), "$1, ");

        return s;
    }
}

/**
 * Ancient Greek (grc) text normalization — the corpus-independent subset and nothing else.
 *
 * ⚠ THIS LANGUAGE HAS NO CORPUS: no FLEURS split, no mined artifact, no usable wiki. So not one rule is
 * argued from instances, which is why not one emits a WORD — `SeparatorHygiene` spends the separators that
 * cannot be anything but separators, and every class that needs evidence (`%`, currency, degrees, the
 * clock, the hyphen, the era marker, the abbreviations) stays open.
 *
 * ⚠ AND "OPEN" IS NOT "VISIBLE", WHICH THIS HEADER USED TO CLAIM (#1214). The SIGNS are dropped and could in
 * principle be seen as a drop. The LETTERS beside them are not: the tokenizer takes any letter run and the
 * g2p has a rule for every letter in it, so a scale letter or a unit symbol is READ as a native phoneme.
 * Nothing is dropped and nothing raw survives — the output is well-formed IPA that means something else,
 * which is trap 56 rather than a leak.
 * Ported from src/languages/ancientgreek/normalize.ts — see that file for what is deliberately left.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.AncientGreek;

public static class Normalize
{
    /** Normalize one Ancient Greek input string. Pure text→text; emits no word. */
    public static string NormalizeAncientGreek(string input) =>
        SeparatorHygienePass.SeparatorHygiene(input);
}

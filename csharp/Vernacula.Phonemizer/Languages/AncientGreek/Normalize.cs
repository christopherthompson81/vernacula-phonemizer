/**
 * Ancient Greek (grc) text normalization — the corpus-independent subset and nothing else.
 *
 * ⚠ THIS LANGUAGE HAS NO CORPUS: no FLEURS split, no mined artifact, no usable wiki. So not one rule is
 * argued from instances, which is why not one emits a WORD — `SeparatorHygiene` spends the separators that
 * cannot be anything but separators, and every class that needs evidence (`%`, currency, degrees, the
 * clock, the hyphen, the era marker, the abbreviations) stays open and visible to the leak gates.
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

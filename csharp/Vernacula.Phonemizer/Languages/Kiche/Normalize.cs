/**
 * K'iche' (quc) TEXT NORMALIZATION — the largest Mayan language, ~1.1M speakers in Guatemala.
 * Ported from src/languages/kiche/normalize.ts — see that file's header for why this language has no
 * corpus and therefore claims NOTHING but the shared separator hygiene: no FLEURS split, no mined
 * artifact, no usable wiki, so not one rule is argued from instances and not one of them emits a word.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kiche;

public static class Normalize
{
    /** Normalize one K'iche' input string. Pure text→text; emits no word. */
    public static string NormalizeKiche(string input) => SeparatorHygienePass.SeparatorHygiene(input);
}

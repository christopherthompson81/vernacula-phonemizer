/**
 * Kalaallisut (kl) text normalization — a digit with a hyphenated Greenlandic case suffix (`25-inik`) is
 * already one correct token, so this pass does nothing but the shared separator hygiene.
 * Ported from src/languages/kalaallisut/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kalaallisut;

public static class Normalize
{
    /** Normalize one Kalaallisut input string. Pure text→text; emits no word. */
    public static string NormalizeKalaallisut(string input) => SeparatorHygienePass.SeparatorHygiene(input);
}

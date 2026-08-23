/**
 * Kalaallisut (kl) text normalization. The language writes a digit with a hyphenated Greenlandic case suffix as
 * ONE mixed-language token (`25-inik`, `1998-imi`), which is already correct and must not be regenerated — so
 * this pass does nothing but the shared separator hygiene.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kalaallisut;

public static class Normalize
{
    /** Normalize one Kalaallisut input string. Pure text→text; emits no word. See the header. */
    public static string NormalizeKalaallisut(string input) => SeparatorHygienePass.SeparatorHygiene(input);
}

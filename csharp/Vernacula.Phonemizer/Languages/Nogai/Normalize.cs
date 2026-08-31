/**
 * Nogai (nog) text normalization — this language has no corpus, so this layer is the corpus-independent
 * subset and nothing else: `SeparatorHygiene` spends the separators that cannot be anything but
 * separators, and every class that needs evidence stays open. Emits no word.
 * Ported from src/languages/nogai/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Nogai;

public static class Normalize
{
    /** Normalize one Nogai input string. Pure text→text; emits no word. */
    public static string NormalizeNogai(string input) => SeparatorHygienePass.SeparatorHygiene(input);
}

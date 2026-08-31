/**
 * Nama (Khoekhoe) TEXT NORMALIZATION — the corpus-independent subset: the shared separator hygiene pass and
 * nothing else. This language has no corpus, so not one rule here emits a word.
 * Ported from src/languages/nama/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Nama;

public static class Normalize
{
    public static string NormalizeNama(string input) => SeparatorHygienePass.SeparatorHygiene(input);
}

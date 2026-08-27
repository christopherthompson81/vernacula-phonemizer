/**
 * Loads the Bambara data manifest (bambara.jsonc): the orthography→IPA grapheme table, the oral vowel
 * letters that are the nasalisation rule's environment, and clause punctuation.
 * Ported from src/languages/bambara/manifest.ts — see that file and the jsonc for the sourcing.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Bambara;

public sealed class BambaraManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();

    /** The oral vowel LETTERS — the environment for the syllable-final ⟨n⟩ nasalisation rule. */
    public IReadOnlyList<string> VowelLetters { get; init; } = [];

    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly BambaraManifest MANIFEST =
        LoadManifest.Load<BambaraManifest>("languages/bambara", "bambara.jsonc");
}

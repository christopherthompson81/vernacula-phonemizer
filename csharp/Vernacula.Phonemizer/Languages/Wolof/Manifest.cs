/**
 * Loads the Wolof data manifest (wolof.jsonc): the orthography→IPA grapheme table (ATR vowels, the
 * vowel-length digraphs, the palatal ⟨c j⟩), the vowel-letter set and clause punctuation. The gemination and
 * nasal-assimilation ALGORITHM stays in code.
 * Ported from src/languages/wolof/manifest.ts — see the jsonc for the sourcing.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Wolof;

public sealed class WolofManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();
    /** The vowel letters — a doubled one is LENGTH, not a geminate. */
    public IReadOnlyList<string> VowelLetters { get; init; } = [];
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly WolofManifest MANIFEST = LoadManifest.Load<WolofManifest>("languages/wolof", "wolof.jsonc");

    /** Grapheme keys sorted LENGTH DESC so the greedy scan tries the vowel digraphs before singles. */
    public static readonly IReadOnlyList<string> GRAPHEME_KEYS =
        MANIFEST.Graphemes.Keys.OrderByDescending(k => k.Length).ToList();
}

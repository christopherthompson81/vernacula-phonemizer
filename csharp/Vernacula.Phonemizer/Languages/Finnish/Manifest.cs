/**
 * Loads the Finnish data manifest (finnish.jsonc): the orthography→IPA grapheme table (8 vowels, the
 * long-vowel and diphthong digraphs, the loan consonants), the vowel-letter set, the cardinal number stems
 * and clause punctuation. The gemination and ⟨ng⟩/⟨nk⟩ ALGORITHM stays in code.
 * Ported from src/languages/finnish/manifest.ts — see the jsonc for the sourcing.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Finnish;

public sealed class FinnishNumbers
{
    public string Zero { get; init; } = "";
    public IReadOnlyList<string> Units { get; init; } = [];
    public string Ten { get; init; } = "";
    public string TensStem { get; init; } = "";
    public string TeenSuffix { get; init; } = "";
    public string Hundred { get; init; } = "";
    public string HundredStem { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string ThousandStem { get; init; } = "";
    public string Million { get; init; } = "";
    public string MillionStem { get; init; } = "";
}

public sealed class FinnishManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();
    /** The vowel letters — a doubled one is a LONG VOWEL, not the geminate a doubled consonant makes. */
    public IReadOnlyList<string> VowelLetters { get; init; } = [];
    public FinnishNumbers Numbers { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly FinnishManifest MANIFEST =
        LoadManifest.Load<FinnishManifest>("languages/finnish", "finnish.jsonc");

    /** Grapheme keys sorted LENGTH DESC so the greedy scan tries the vowel digraphs before the singles. */
    public static readonly IReadOnlyList<string> GRAPHEME_KEYS =
        MANIFEST.Graphemes.Keys.OrderByDescending(k => k.Length).ToList();
}

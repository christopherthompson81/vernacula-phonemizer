/**
 * Loads the Norwegian Bokmål data manifest (norwegian.jsonc) once and exposes it typed — the vowel
 * length/quality tables, digraphs, consonants, retroflex pairs, front-vowel set, number and ordinal words.
 * Ported from src/languages/norwegian/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Norwegian;

public sealed class NorwegianVowels
{
    public IReadOnlyDictionary<string, string> Long { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Short { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> LongBeforeR { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ShortBeforeR { get; init; } = new Dictionary<string, string>();
}

public sealed class NorwegianManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = Array.Empty<string>();
    public string FrontVowels { get; init; } = "";
    public NorwegianVowels Vowels { get; init; } = new();
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Retroflex { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public NumbersDef Numbers { get; init; } = new();
    /** The ordinal series. */
    public IReadOnlyDictionary<string, string> Ordinals { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly NorwegianManifest MANIFEST =
        LoadManifest.Load<NorwegianManifest>("languages/norwegian", "norwegian.jsonc");
}

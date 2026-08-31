/**
 * Loads the Latvian data manifest (latvian.jsonc) once and exposes it typed. It holds the context-free DATA —
 * the vowel / long-vowel / consonant tables, the voicing pairs, clause punctuation and the number words. The
 * ALGORITHMS that read them stay in code (G2p.cs / Latvian.cs / Numbers.cs).
 *
 * Ported from src/languages/latvian/manifest.ts.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Latvian;

public sealed record LatvianVoicing
{
    public IReadOnlyDictionary<string, string> ToVoiceless { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ToVoiced { get; init; } = new Dictionary<string, string>();
}

public sealed record CountedNoun
{
    public string One { get; init; } = "";
    public string Many { get; init; } = "";
}

public sealed record LatvianNumbers
{
    public IReadOnlyList<string> Units { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Teens { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Tens { get; init; } = Array.Empty<string>();
    public CountedNoun Hundred { get; init; } = new();
    public CountedNoun Thousand { get; init; } = new();
    public CountedNoun Million { get; init; } = new();
}

public sealed record LatvianManifest
{
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> LongVowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ConsonantDigraphs { get; init; } = new Dictionary<string, string>();
    public LatvianVoicing Voicing { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public LatvianNumbers Numbers { get; init; } = new();
}

public static class Manifest
{
    public static readonly LatvianManifest MANIFEST =
        LoadManifest.Load<LatvianManifest>("languages/latvian", "latvian.jsonc");
}

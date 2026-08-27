/**
 * Loads the Slovenian data manifest (slovenian.jsonc) — the vowel/consonant tables, the voicing pairs,
 * clause punctuation, the spelled-out acronyms and the cardinal number words.
 * Ported from src/languages/slovenian/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Slovenian;

public sealed class SlovenianVoicing
{
    public IReadOnlyDictionary<string, string> ToVoiceless { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ToVoiced { get; init; } = new Dictionary<string, string>();
}

public sealed class SlovenianMagnitude
{
    public string Gender { get; init; } = "";
    public string Sg { get; init; } = "";
    public string Dual { get; init; } = "";
    public string Paucal { get; init; } = "";
    public string Plural { get; init; } = "";
}

public sealed class SlovenianMagnitudes
{
    public SlovenianMagnitude Million { get; init; } = new();
    public SlovenianMagnitude Milliard { get; init; } = new();
}

public sealed class SlovenianNumbers
{
    public IReadOnlyList<string> Units { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Teens { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Tens { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Hundreds { get; init; } = Array.Empty<string>();
    public string And { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string DecimalWord { get; init; } = "";
    public IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> CountForms { get; init; } =
        new Dictionary<string, IReadOnlyDictionary<string, string>>();
    public SlovenianMagnitudes Magnitudes { get; init; } = new();
}

public sealed class SlovenianManifest
{
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public SlovenianVoicing Voicing { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public IReadOnlyList<string> AcronymLetters { get; init; } = Array.Empty<string>();
    public SlovenianNumbers Numbers { get; init; } = new();
}

public static class Manifest
{
    public static readonly SlovenianManifest MANIFEST =
        LoadManifest.Load<SlovenianManifest>("languages/slovenian", "slovenian.jsonc");
}

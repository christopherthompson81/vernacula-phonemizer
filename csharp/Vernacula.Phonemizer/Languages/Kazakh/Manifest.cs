/**
 * Loads the Kazakh data manifest (kazakh.jsonc) once and exposes it typed — the letter→IPA tables, the
 * front-vowel harmony trigger set, clause punctuation, and the pre-phonemized cardinal number forms.
 * Ported from src/languages/kazakh/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kazakh;

public sealed class KazakhNumbersDef
{
    public string[] Units { get; init; } = [];
    public string[] Tens { get; init; } = [];
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
}

public sealed class KazakhManifest
{
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Glides { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public string FrontVowels { get; init; } = "";
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public KazakhNumbersDef Numbers { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Kazakh data tables (see kazakh.jsonc). */
    public static readonly KazakhManifest MANIFEST =
        LoadManifest.Load<KazakhManifest>("languages/kazakh", "kazakh.jsonc");
}

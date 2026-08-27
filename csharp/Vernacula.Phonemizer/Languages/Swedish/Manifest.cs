/**
 * Loads the Swedish data manifest (swedish.jsonc) once at module init and exposes it typed.
 * Ported from src/languages/swedish/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Swedish;

public sealed class SwedishVowels
{
    public IReadOnlyDictionary<string, string> Long { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Short { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> LongBeforeR { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ShortBeforeR { get; init; } = new Dictionary<string, string>();
}

public sealed class SwedishMillion
{
    public string Sg { get; init; } = "";
    public string Pl { get; init; } = "";
}

public sealed class SwedishNumbersDef
{
    public string[] Ones { get; init; } = [];
    public string[] Tens { get; init; } = [];
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public SwedishMillion Million { get; init; } = new();
}

public sealed class SwedishManifest
{
    public string VowelChars { get; init; } = "";
    public string FrontVowels { get; init; } = "";
    public SwedishVowels Vowels { get; init; } = new();
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Retroflex { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Exceptions { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public SwedishNumbersDef Numbers { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Swedish data tables (see swedish.jsonc). */
    public static readonly SwedishManifest MANIFEST = LoadManifest.Load<SwedishManifest>("languages/swedish", "swedish.jsonc");
}

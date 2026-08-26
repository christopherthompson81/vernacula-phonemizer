/**
 * Loads the Somali data manifest (somali.jsonc) once and exposes it typed. DATA only — the vowel/consonant
 * tables, clause punctuation and the number words; the algorithms stay in code.
 * Ported from src/languages/somali/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Somali;

public sealed class SomaliNumbersDef
{
    public string[] Ones { get; init; } = [];
    public string[] Tens { get; init; } = [];
    public string Connector { get; init; } = "";
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
}

public sealed class SomaliManifest
{
    public IReadOnlyDictionary<string, string> LongVowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ShortVowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public SomaliNumbersDef Numbers { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Somali data tables (see somali.jsonc). */
    public static readonly SomaliManifest MANIFEST = LoadManifest.Load<SomaliManifest>("languages/somali", "somali.jsonc");
}

/**
 * Loads the Danish data manifest (danish.jsonc): the base letter→IPA tables, clause punctuation, the
 * cardinal number words and the ordinal series.
 * Ported from src/languages/danish/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Danish;

public sealed class DanishOneWord
{
    public string One { get; init; } = "";
    public string Word { get; init; } = "";
}

public sealed class DanishOnePlural
{
    public string One { get; init; } = "";
    public string Plural { get; init; } = "";
}

public sealed class DanishNumbersDef
{
    public string[] Ones { get; init; } = [];
    public string[] Tens { get; init; } = [];
    public string Connector { get; init; } = "";
    public DanishOneWord Hundred { get; init; } = new();
    public DanishOneWord Thousand { get; init; } = new();
    public DanishOnePlural Million { get; init; } = new();
    public DanishOnePlural Billion { get; init; } = new();
}

public sealed class DanishManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public DanishNumbersDef Numbers { get; init; } = new();
    /** The ordinal series. */
    public IReadOnlyDictionary<string, string> Ordinals { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    /** The consolidated hand-authored Danish data tables (see danish.jsonc). */
    public static readonly DanishManifest MANIFEST = LoadManifest.Load<DanishManifest>("languages/danish", "danish.jsonc");
}

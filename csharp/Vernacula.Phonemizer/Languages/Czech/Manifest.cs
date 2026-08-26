/**
 * Loads the consolidated Czech data manifest (czech.jsonc) once and exposes it typed.
 * Ported from src/languages/czech/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Czech;

/** A Slavic magnitude noun's three count forms: sg (1), paucal (2–4), gen-pl (5+ / 12–14). */
public sealed class Agreement
{
    public string Sg { get; init; } = "";
    public string Paucal { get; init; } = "";
    public string Plural { get; init; } = "";
}

public sealed class CzechPalatalisation
{
    public IReadOnlyDictionary<string, string> Map { get; init; } = new Dictionary<string, string>();
    public string[] Triggers { get; init; } = [];
}

public sealed class CzechVoicing
{
    public IReadOnlyDictionary<string, string> ToVoiceless { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ToVoiced { get; init; } = new Dictionary<string, string>();
}

public sealed class CzechMagnitudes
{
    public Agreement Thousand { get; init; } = new();
    public Agreement Million { get; init; } = new();
    public Agreement Billion { get; init; } = new();
}

public sealed class CzechNumbersDef
{
    public string[] Units { get; init; } = [];
    public string[] Teens { get; init; } = [];
    public string[] Tens { get; init; } = [];
    public string[] Hundreds { get; init; } = [];
    public CzechMagnitudes Magnitudes { get; init; } = new();
}

public sealed class CzechManifest
{
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public CzechPalatalisation Palatalisation { get; init; } = new();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public CzechVoicing Voicing { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    /** LEXICAL: acronyms Czech spells out although the letters could be read as a word. */
    public string[] AcronymLetters { get; init; } = [];
    public CzechNumbersDef Numbers { get; init; } = new();
}

public static class Manifest
{
    public static readonly CzechManifest MANIFEST = LoadManifest.Load<CzechManifest>("languages/czech", "czech.jsonc");
}

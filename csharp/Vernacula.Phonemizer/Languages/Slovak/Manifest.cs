/**
 * Loads the consolidated Slovak data manifest (slovak.jsonc) once and exposes it typed.
 * Ported from src/languages/slovak/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Slovak;

/** A Slavic magnitude noun's three count forms: sg (1), paucal (2–4), gen-pl (5+). */
public sealed class Agreement
{
    public string Sg { get; init; } = "";
    public string Paucal { get; init; } = "";
    public string Plural { get; init; } = "";
}

public sealed class SlovakPalatalisation
{
    public IReadOnlyDictionary<string, string> Map { get; init; } = new Dictionary<string, string>();
    public string[] Triggers { get; init; } = [];
}

public sealed class SlovakVoicing
{
    public IReadOnlyDictionary<string, string> ToVoiceless { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ToVoiced { get; init; } = new Dictionary<string, string>();
}

public sealed class SlovakMagnitudes
{
    public Agreement Thousand { get; init; } = new();
    public Agreement Million { get; init; } = new();
}

public sealed class SlovakNumbersDef
{
    public string[] Units { get; init; } = [];
    public string[] Teens { get; init; } = [];
    public string[] Tens { get; init; } = [];
    public string[] Hundreds { get; init; } = [];
    public SlovakMagnitudes Magnitudes { get; init; } = new();
}

public sealed class SlovakManifest
{
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public SlovakPalatalisation Palatalisation { get; init; } = new();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public SlovakVoicing Voicing { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    /** LEXICAL: acronyms Slovak spells out although the lowercase form could be read as a word. */
    public string[] AcronymLetters { get; init; } = [];
    public SlovakNumbersDef Numbers { get; init; } = new();
}

public static class Manifest
{
    public static readonly SlovakManifest MANIFEST = LoadManifest.Load<SlovakManifest>("languages/slovak", "slovak.jsonc");
}

/**
 * Loads the Nigerian Pidgin / Naija data manifest (naija.jsonc) once and exposes it typed.
 * Ported from src/languages/naija/naija.ts (its `NaijaDef` interface) — see that file and the jsonc for
 * the sourcing behind the lexicon, the numerals and the ordinal marker.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Naija;

public sealed class NaijaNumbersDef
{
    public string[] Units { get; init; } = [];
    public string[] Teens { get; init; } = [];
    public string[] Tens { get; init; } = [];
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
    public string Billion { get; init; } = "";
    public string And { get; init; } = "";
    public string Point { get; init; } = "";
}

public sealed class NaijaOrdinalsDef
{
    public string Marker { get; init; } = "";
    public string First { get; init; } = "";
    public string Second { get; init; } = "";
    public string Third { get; init; } = "";
}

public sealed class NaijaManifest
{
    public IReadOnlyDictionary<string, string> LetterNames { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Lexicon { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public NaijaNumbersDef Numbers { get; init; } = new();
    public NaijaOrdinalsDef Ordinals { get; init; } = new();
}

public static class Manifest
{
    public static readonly NaijaManifest MANIFEST = LoadManifest.Load<NaijaManifest>("languages/naija", "naija.jsonc");
}

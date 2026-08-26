/**
 * Loads the Catalan data manifest (catalan.jsonc) once at module init and exposes it typed.
 * Ported from src/languages/catalan/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Catalan;

public sealed class VowelReal
{
    public string Stressed { get; init; } = "";
    public string Reduced { get; init; } = "";
}

public sealed class CatalanMillion
{
    public string Sg { get; init; } = "";
    public string Pl { get; init; } = "";
}

public sealed class CatalanNumbers
{
    public IReadOnlyList<string> Ones { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Tens { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Hundreds { get; init; } = Array.Empty<string>();
    public string Thousand { get; init; } = "";
    public CatalanMillion Million { get; init; } = new();
    /** The twenties connector — vint I un. */
    public string And { get; init; } = "";
    public string DecimalConnector { get; init; } = "";
}

public sealed class CatalanManifest
{
    /** ⚠ INSERTION-ORDERED: g2p's VOWEL_CHARS is the concatenation of this map's key order. */
    public IReadOnlyDictionary<string, VowelReal> Vowels { get; init; } = new Dictionary<string, VowelReal>();
    public string AccentedVowels { get; init; } = "";
    public string FrontVowels { get; init; } = "";
    public IReadOnlyList<string> Nasals { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Spirantize { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> FinalDevoice { get; init; } = new Dictionary<string, string>();
    public IReadOnlyList<string> Palatals { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> FunctionWords { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public CatalanNumbers Numbers { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Catalan data tables (see catalan.jsonc). */
    public static readonly CatalanManifest MANIFEST =
        LoadManifest.Load<CatalanManifest>("languages/catalan", "catalan.jsonc");
}

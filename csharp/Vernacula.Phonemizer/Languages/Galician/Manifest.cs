/**
 * Loads the Galician data manifest (galician.jsonc) once at module init and exposes it typed.
 * Ported from src/languages/galician/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Galician;

public sealed class GalicianVowels
{
    public string Strong { get; init; } = "";
    public string WeakUnaccented { get; init; } = "";
    public string WeakAccented { get; init; } = "";
    public string Front { get; init; } = "";
}

public sealed class GalicianScale
{
    public string One { get; init; } = "";
    public string Many { get; init; } = "";
}

public sealed class GalicianNumbers
{
    public IReadOnlyList<string> Ones { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Tens { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Hundreds { get; init; } = Array.Empty<string>();
    public string HundredExact { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Connector { get; init; } = "";
    public string DecimalConnector { get; init; } = "";
    public GalicianScale Million { get; init; } = new();
    public GalicianScale Billion { get; init; } = new();
}

public sealed class GalicianManifest
{
    public GalicianVowels Vowels { get; init; } = new();
    public IReadOnlyDictionary<string, string> Accents { get; init; } = new Dictionary<string, string>();
    public IReadOnlyList<string> Nasals { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Velars { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Spirantize { get; init; } = new Dictionary<string, string>();
    public IReadOnlyList<string> FunctionWords { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public GalicianNumbers Numbers { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Galician data tables (see galician.jsonc). */
    public static readonly GalicianManifest MANIFEST =
        LoadManifest.Load<GalicianManifest>("languages/galician", "galician.jsonc");
}

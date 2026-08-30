/**
 * Loads the Kabuverdianu data manifest (kabuverdianu.jsonc) once at module init and exposes it typed.
 * Ported from src/languages/kabuverdianu/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kabuverdianu;

public sealed class KabuverdianuMillion
{
    public string One { get; init; } = "";
    public string Word { get; init; } = "";
}

public sealed class KabuverdianuNumbers
{
    public IReadOnlyList<string> Ones { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Teens { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Tens { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Hundreds { get; init; } = Array.Empty<string>();
    public string Thousand { get; init; } = "";
    public KabuverdianuMillion Million { get; init; } = new();
}

public sealed class KabuverdianuManifest
{
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyList<string> AccentedVowels { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> VowelLetters { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public IReadOnlyList<string> Ordinals { get; init; } = Array.Empty<string>();
    public KabuverdianuNumbers Numbers { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Kabuverdianu data tables (see kabuverdianu.jsonc). */
    public static readonly KabuverdianuManifest MANIFEST =
        LoadManifest.Load<KabuverdianuManifest>("languages/kabuverdianu", "kabuverdianu.jsonc");
}

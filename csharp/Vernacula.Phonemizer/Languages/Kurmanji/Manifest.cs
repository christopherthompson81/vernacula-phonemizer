/**
 * Loads the Kurmanji data manifest (kurmanji.jsonc) once and exposes it typed.
 * Ported from src/languages/kurmanji/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kurmanji;

public sealed class KurmanjiNumbersDef
{
    public string[] Units { get; init; } = [];
    public string[] Teens { get; init; } = [];
    public string[] Tens { get; init; } = [];
    public string Connector { get; init; } = "";
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
}

public sealed class KurmanjiManifest
{
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public KurmanjiNumbersDef Numbers { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Kurmanji data tables (see kurmanji.jsonc). */
    public static readonly KurmanjiManifest MANIFEST =
        LoadManifest.Load<KurmanjiManifest>("languages/kurmanji", "kurmanji.jsonc");
}

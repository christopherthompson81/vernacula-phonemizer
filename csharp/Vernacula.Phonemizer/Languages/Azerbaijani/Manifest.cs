/**
 * Loads the Azerbaijani data manifest (azerbaijani.jsonc) once and exposes it typed.
 * Ported from src/languages/azerbaijani/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Azerbaijani;

public sealed class AzerbaijaniVowels
{
    public IReadOnlyDictionary<string, string> Ipa { get; init; } = new Dictionary<string, string>();
    public string[] Front { get; init; } = [];
    public string[] Back { get; init; } = [];
}

public sealed class AzerbaijaniNumbersDef
{
    public string[] Ones { get; init; } = [];
    public string[] Tens { get; init; } = [];
    public string[] Scales { get; init; } = [];
    public string Hundred { get; init; } = "";
    public string Zero { get; init; } = "";
    public string DecimalConnector { get; init; } = "";
}

public sealed class AzerbaijaniManifest
{
    public AzerbaijaniVowels Vowels { get; init; } = new();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public string[] Geminate { get; init; } = [];
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public AzerbaijaniNumbersDef Numbers { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Azerbaijani data tables (see azerbaijani.jsonc). */
    public static readonly AzerbaijaniManifest MANIFEST =
        LoadManifest.Load<AzerbaijaniManifest>("languages/azerbaijani", "azerbaijani.jsonc");
}

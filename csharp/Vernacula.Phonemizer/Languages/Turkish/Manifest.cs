/**
 * Loads the Turkish data manifest (turkish.jsonc) once at module init and exposes it typed.
 * Ported from src/languages/turkish/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Turkish;

public sealed class TurkishVowels
{
    public IReadOnlyDictionary<string, string> Ipa { get; init; } = new Dictionary<string, string>();
    public string[] Front { get; init; } = [];
    public string[] FrontUnround { get; init; } = [];
    public string[] Back { get; init; } = [];
}

public sealed class TurkishNumbersDef
{
    public string[] Ones { get; init; } = [];
    public string[] Tens { get; init; } = [];
    public string[] Scales { get; init; } = [];
    public string Hundred { get; init; } = "";
    public string Zero { get; init; } = "";
    public string DecimalConnector { get; init; } = "";
}

public sealed class TurkishManifest
{
    public TurkishVowels Vowels { get; init; } = new();
    public IReadOnlyDictionary<string, string> CircumflexFold { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public string[] Geminate { get; init; } = [];
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public TurkishNumbersDef Numbers { get; init; } = new();
    public IReadOnlyDictionary<string, string> LetterNames { get; init; } = new Dictionary<string, string>();
    public TurkishPhonotactics Phonotactics { get; init; } = new();
    /** The shared symbol tier's data — see the jsonc, where the evidence lives. */
    public TurkishSymbolTier SymbolTier { get; init; } = new();
}

public sealed class TurkishPhonotactics
{
    public string Vowels { get; init; } = "";
    public IReadOnlyList<string> Onsets { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Codas { get; init; } = Array.Empty<string>();
}

public static class Manifest
{
    /** The consolidated hand-authored Turkish data tables (see turkish.jsonc). */
    public static readonly TurkishManifest MANIFEST = LoadManifest.Load<TurkishManifest>("languages/turkish", "turkish.jsonc");
}

public sealed class TurkishSymbolTier
{
    public IReadOnlyList<string> Percent { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Currency { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Units { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public ExponentWordsDef ExponentWords { get; init; } = new();
    public MultiplyDef Multiply { get; init; } = null!;
    public bool PercentPrefix { get; init; } = false;
}

/**
 * Loads the Tajik data manifest (tajik.jsonc) once at module init and exposes it typed.
 * Ported from src/languages/tajik/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Tajik;

public sealed class TajikNumbersDef
{
    public string[] Units { get; init; } = [];
    public string[] Teens { get; init; } = [];
    public IReadOnlyDictionary<string, string> Tens { get; init; } = new Dictionary<string, string>();
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
    public string Milliard { get; init; } = "";
    public string Trillion { get; init; } = "";
    public string And { get; init; } = "";
}

public sealed class TajikManifest
{
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Glides { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public TajikNumbersDef Numbers { get; init; } = new();
    /** Month names in the IZOFAT form the corpus writes (`16 ноябри соли 1992`), for the dotted-date rule. */
    public string[] Months { get; init; } = [];
    /** Tajik Cyrillic letter → its spoken NAME, for core/initialisms.ts. */
    public IReadOnlyDictionary<string, string> LetterNames { get; init; } = new Dictionary<string, string>();
    /** Acronyms read letter-by-letter although phonotactics would pass them as words. */
    public string[] AcronymLetters { get; init; } = [];
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public TajikPhonotactics Phonotactics { get; init; } = new();
    /** The shared symbol tier's data — see the jsonc, where the evidence lives. */
    public TajikSymbolTier SymbolTier { get; init; } = new();
}

public sealed class TajikPhonotactics
{
    public string Vowels { get; init; } = "";
    public IReadOnlyList<string> Onsets { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Codas { get; init; } = Array.Empty<string>();
}

public static class Manifest
{
    /** The consolidated hand-authored Tajik data tables (see tajik.jsonc). */
    public static readonly TajikManifest MANIFEST = LoadManifest.Load<TajikManifest>("languages/tajik", "tajik.jsonc");
}

public sealed class TajikSymbolTier
{
    public IReadOnlyList<string> Percent { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Currency { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Units { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, string> RateDenominators { get; init; } = new Dictionary<string, string>();
    public UnitPerSpec UnitPer { get; init; } = null!;
    public IReadOnlyList<string> Magnitudes { get; init; } = Array.Empty<string>();
    public string Ampersand { get; init; } = "";
}

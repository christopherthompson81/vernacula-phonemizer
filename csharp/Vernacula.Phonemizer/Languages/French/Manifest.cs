/**
 * Loads the French data manifest (french.jsonc) once at module init and exposes it typed.
 * Ported from src/languages/french/manifest.ts — see that file for the corpus evidence.
 */
using System.Text.Json.Serialization;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.French;

public sealed class HeteronymCase
{
    public string Ipa { get; init; } = "";
    public IReadOnlyList<string>? Prev { get; init; }
    public IReadOnlyList<string>? Next { get; init; }
    public bool? NextIsNumber { get; init; }
}

public sealed class HeteronymEntry
{
    /** Recorded as documentation of the Lexique reading; deliberately not re-asserted by the resolver. */
    [JsonPropertyName("default")]
    public string Default { get; init; } = "";
    public IReadOnlyList<HeteronymCase> Cases { get; init; } = Array.Empty<HeteronymCase>();
}

public sealed class FrenchMagnitudes
{
    public string Sixty { get; init; } = "";
    public string Eighty { get; init; } = "";
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
    public string Millions { get; init; } = "";
}

public sealed class FrenchNumberData
{
    public IReadOnlyList<string> Small { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Tens { get; init; } = Array.Empty<string>();
    public FrenchMagnitudes Magnitudes { get; init; } = new();
    public string DecimalSeparator { get; init; } = "";
}

public sealed class FrenchManifest
{
    public string VowelLetters { get; init; } = "";
    public string VowelPhonemes { get; init; } = "";
    public IReadOnlyList<string[]> VowelGroups { get; init; } = Array.Empty<string[]>();
    public IReadOnlyList<string[]> NasalGroups { get; init; } = Array.Empty<string[]>();
    public IReadOnlyList<string> FinalSounded { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string[]> YodDouble { get; init; } = Array.Empty<string[]>();
    public IReadOnlyList<string[]> YodFinal { get; init; } = Array.Empty<string[]>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Liaison { get; init; } = new Dictionary<string, string>();
    /** One spelling → its Lexique reading plus the context-selected alternates. See french.jsonc. */
    public IReadOnlyDictionary<string, HeteronymEntry> Heteronyms { get; init; } = new Dictionary<string, HeteronymEntry>();
    public IReadOnlyList<string> AcronymLetters { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> HAspire { get; init; } = Array.Empty<string>();
    public FrenchNumberData Numbers { get; init; } = new();
    public IReadOnlyDictionary<string, string> LetterNames { get; init; } = new Dictionary<string, string>();
    public FrenchPhonotactics Phonotactics { get; init; } = new();
    /** The shared symbol tier's data — see the jsonc, where the evidence lives. */
    public FrenchSymbols Symbols { get; init; } = new();
}

public sealed class FrenchPhonotactics
{
    public string Vowels { get; init; } = "";
    public IReadOnlyList<string> Onsets { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Codas { get; init; } = Array.Empty<string>();
}

public static class Manifest
{
    /** The consolidated hand-authored French data tables (see french.jsonc). */
    public static readonly FrenchManifest MANIFEST =
        LoadManifest.Load<FrenchManifest>("languages/french", "french.jsonc");
}

public sealed class FrenchSymbols
{
    public IReadOnlyList<string> Percent { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Currency { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Units { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public ExponentWordsDef ExponentWords { get; init; } = new();
    public BareExponentDef BareExponent { get; init; } = new();
    public IReadOnlyList<string> Magnitudes { get; init; } = Array.Empty<string>();
    public string MagnitudeConnective { get; init; } = "";
    public string Ampersand { get; init; } = "";
    public MultiplyDef Multiply { get; init; } = null!;
}

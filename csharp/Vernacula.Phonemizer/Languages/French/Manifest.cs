/**
 * Loads the French data manifest (french.jsonc) once at module init and exposes it typed. The hand-authored
 * DATA tables (vowel-letter inventory, oral/nasal vowel-multigraph tables, yod groups, sounded-final set, clause
 * punctuation, liaison + h-aspiré lists, number words) live in the JSONC; the ALGORITHMS that consume them stay
 * in the sibling modules (g2p.ts, french.ts, numbers.ts).
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
}

public static class Manifest
{
    /** The consolidated hand-authored French data tables (see french.jsonc). */
    public static readonly FrenchManifest MANIFEST =
        LoadManifest.Load<FrenchManifest>("languages/french", "french.jsonc");
}

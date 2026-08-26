/**
 * The consolidated hand-authored Tagalog data tables (tagalog.jsonc).
 * Ported from src/languages/tagalog/manifest.ts — see that file for why it is a separate module.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Tagalog;

public sealed class TagalogNumbersDef
{
    public IReadOnlyList<string> Units { get; init; } = Array.Empty<string>();
    /** 10–19: explicit (irregular labing- sandhi). */
    public IReadOnlyList<string> Teens { get; init; } = Array.Empty<string>();
    /** Indexed by tens digit 1–9: explicit (o→u raising, na/ng split). */
    public IReadOnlyList<string> Tens { get; init; } = Array.Empty<string>();
    public string Hundred { get; init; } = "";
    /** raan (after a " na" ligature: apat na raan). */
    public string HundredAfterNa { get; init; } = "";
    public string Hundred1 { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Thousand1 { get; init; } = "";
    public string Million { get; init; } = "";
    /** at → 't after a vowel. */
    public string And { get; init; } = "";
    /** Number roots that are penult- not final-stressed (séro, ápat, líbo, …). */
    public IReadOnlyList<string> StressPenult { get; init; } = Array.Empty<string>();
}

public sealed class TagalogDef
{
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> SpecialWords { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public TagalogNumbersDef Numbers { get; init; } = new();
    /** The two CONTRACTED ordinals; `ika-N` is regular and composed in code. */
    public IReadOnlyDictionary<string, string> ContractedOrdinals { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly TagalogDef MANIFEST = LoadManifest.Load<TagalogDef>("languages/tagalog", "tagalog.jsonc");
}

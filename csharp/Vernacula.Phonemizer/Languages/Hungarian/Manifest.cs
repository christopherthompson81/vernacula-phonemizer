/**
 * Loads the Hungarian data manifest (hungarian.jsonc) once at module init and exposes it typed.
 * Ported from src/languages/hungarian/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hungarian;

public sealed class HungarianNumbersDef
{
    public string[] Units { get; init; } = [];
    public string[] Teens { get; init; } = [];
    public string[] Tens { get; init; } = [];
    public IReadOnlyDictionary<string, string> TensPrefix { get; init; } = new Dictionary<string, string>();
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
    public string Milliard { get; init; } = "";
}

public sealed class HungarianManifest
{
    /**
     * The longest-match orthography→IPA rule table. The TS type is a tuple, `[string, string, boolean][]`,
     * which JSON writes as an array-of-arrays; System.Text.Json has no tuple deserializer for that shape, so
     * the rows arrive as JsonElement and are projected once into `RULES` below.
     */
    public List<List<System.Text.Json.JsonElement>> Rules { get; init; } = new();
    public IReadOnlyList<string> VoicelessTriggers { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> VoicedTriggers { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public HungarianNumbersDef Numbers { get; init; } = new();
    public IReadOnlyDictionary<string, string> LetterNames { get; init; } = new Dictionary<string, string>();
    public HungarianPhonotactics Phonotactics { get; init; } = new();
    /** The shared symbol tier's data — see the jsonc, where the evidence lives. */
    public HungarianSymbolTier SymbolTier { get; init; } = new();
    /** The ordinal form of each morph that can END a cardinal. See the jsonc. */
    public IReadOnlyDictionary<string, string> OrdinalMorphs { get; init; } = new Dictionary<string, string>();
    /** Multiplicative form of each morph that can END a cardinal (-szor/-szer/-ször). */
    public IReadOnlyDictionary<string, string> MultiplicativeMorphs { get; init; } = new Dictionary<string, string>();
}

public sealed class HungarianPhonotactics
{
    public string Vowels { get; init; } = "";
    public IReadOnlyList<string> Onsets { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Codas { get; init; } = Array.Empty<string>();
}

/** One row of the orthography→IPA table: the grapheme, its IPA, and whether it is a VOWEL. */
public sealed record HungarianRule(string Orth, string Ipa, bool V);

public static class Manifest
{
    /** The consolidated hand-authored Hungarian data tables (see hungarian.jsonc). */
    public static readonly HungarianManifest MANIFEST =
        LoadManifest.Load<HungarianManifest>("languages/hungarian", "hungarian.jsonc");

    /** The rule tuples, projected once out of their JSON arrays. Order is the file's — the scan is
     *  LONGEST-MATCH BY POSITION, not by length, so re-sorting would change the reading. */
    public static readonly IReadOnlyList<HungarianRule> RULES = MANIFEST.Rules
        .Select(r => new HungarianRule(r[0].GetString()!, r[1].GetString()!, r[2].GetBoolean()))
        .ToList();
}

public sealed class HungarianSymbolTier
{
    public IReadOnlyList<string> Percent { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Currency { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Units { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, string> RateDenominators { get; init; } = new Dictionary<string, string>();
    public UnitPerSpec UnitPer { get; init; } = null!;
    public ExponentWordsDef ExponentWords { get; init; } = new();
    public string Ampersand { get; init; } = "";
}

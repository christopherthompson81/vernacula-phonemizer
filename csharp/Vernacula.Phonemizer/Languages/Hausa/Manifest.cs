/**
 * Loads the Hausa data manifest (hausa.jsonc) once at module init and exposes it typed.
 * Ported from src/languages/hausa/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hausa;

public sealed class HausaNumbersDef
{
    public string[] Ones { get; init; } = [];
    public string[] Tens { get; init; } = [];
    public string TeensConnector { get; init; } = "";
    public string Connector { get; init; } = "";
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
    public string Billion { get; init; } = "";
}

public sealed class HausaManifest
{
    /**
     * The longest-match orthography→IPA rule table. The TS type is a tuple, `[string, string, boolean][]`,
     * which JSON writes as an array-of-arrays; System.Text.Json has no tuple deserializer for that shape, so
     * the rows arrive as JsonElement and are projected once into `RULES` below.
     */
    public List<List<System.Text.Json.JsonElement>> Rules { get; init; } = new();
    public IReadOnlyDictionary<string, string> ToneChao { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public HausaNumbersDef Numbers { get; init; } = new();
    public IReadOnlyDictionary<string, string> LetterNames { get; init; } = new Dictionary<string, string>();
    public HausaPhonotactics Phonotactics { get; init; } = new();
    /** The shared symbol tier's data — see the jsonc, where the evidence lives. */
    public HausaSymbolTier SymbolTier { get; init; } = new();
}

public sealed class HausaPhonotactics
{
    public string Vowels { get; init; } = "";
    public IReadOnlyList<string> Onsets { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Codas { get; init; } = Array.Empty<string>();
}

/** One row of the orthography→IPA table: the grapheme, its IPA, and whether it is a syllable NUCLEUS. */
public sealed record HausaRule(string Orth, string Ipa, bool Nuc);

public static class Manifest
{
    /** The consolidated hand-authored Hausa data tables (see hausa.jsonc). */
    public static readonly HausaManifest MANIFEST = LoadManifest.Load<HausaManifest>("languages/hausa", "hausa.jsonc");

    /** The rule tuples, projected once out of their JSON arrays. Order is the file's — the scan below is
     *  LONGEST-MATCH BY POSITION, not by length, so re-sorting would change the reading. */
    public static readonly IReadOnlyList<HausaRule> RULES = MANIFEST.Rules
        .Select(r => new HausaRule(r[0].GetString()!, r[1].GetString()!, r[2].GetBoolean()))
        .ToList();
}

public sealed class HausaSymbolTier
{
    public IReadOnlyList<string> Percent { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Currency { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Units { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public ExponentWordsDef ExponentWords { get; init; } = new();
    public MultiplyDef Multiply { get; init; } = null!;
    public bool PercentPrefix { get; init; } = false;
}

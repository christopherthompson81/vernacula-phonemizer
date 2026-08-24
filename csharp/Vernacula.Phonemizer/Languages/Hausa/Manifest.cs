/**
 * Loads the Hausa data manifest (hausa.jsonc) once at module init and exposes it typed. The hand-authored DATA
 * (the longest-match orthography→IPA rule table, the tone-code→Chao map, clause punctuation, and the number
 * words) lives in the JSONC; the ALGORITHM (longest-match scan + penultimate stress + tone overlay) stays in
 * g2p.ts / hausa.ts / numbers.ts, and the per-word tone lexicon is a separate file (tone.tsv).
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
     * The longest-match orthography→IPA rule table. ⚠ THE TS TYPE IS A TUPLE, `[string, string, boolean][]`,
     * which JSON writes as an array-of-arrays; C# has no tuple deserializer for that shape in
     * System.Text.Json, so the rows arrive as `object[][]` and are projected once into `RULES` below.
     */
    public List<List<System.Text.Json.JsonElement>> Rules { get; init; } = new();
    public IReadOnlyDictionary<string, string> ToneChao { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public HausaNumbersDef Numbers { get; init; } = new();
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

/**
 * Loads the Fula data manifest (fula.jsonc) once and exposes it typed — the longest-match orthography→IPA
 * rule table, the Adlam front-end tables and the clause punctuation. DATA only; the algorithms stay in code.
 * Ported from src/languages/fula/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Fula;

/** The Adlam front-end: letter → Boko/Latin, plus the combining marks. */
public sealed class FulaAdlamDef
{
    public IReadOnlyDictionary<string, string> Letters { get; init; } = new Dictionary<string, string>();
    public IReadOnlyList<string> Lengtheners { get; init; } = Array.Empty<string>();
    public string Gemination { get; init; } = "";
    public string Hamza { get; init; } = "";
    public IReadOnlyList<string> Drop { get; init; } = Array.Empty<string>();
}

public sealed class FulaManifest
{
    /**
     * The longest-match orthography→IPA rule table. The TS type is a tuple, `[string, string, boolean][]`,
     * which JSON writes as an array-of-arrays; System.Text.Json has no tuple deserializer for that shape, so
     * the rows arrive as JsonElement and are projected once into `RULES` below.
     */
    public List<List<System.Text.Json.JsonElement>> Rules { get; init; } = new();
    /** The LATIN spelling vowels the Adlam lengthener doubles; not IPA. */
    public IReadOnlyList<string> LatinVowels { get; init; } = Array.Empty<string>();
    public FulaAdlamDef Adlam { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

/** One row of the orthography→IPA table: the grapheme, its IPA, and whether it is a syllable NUCLEUS. */
public sealed record FulaRule(string Orth, string Ipa, bool Nuc);

public static class Manifest
{
    /** The consolidated hand-authored Fula data tables (see fula.jsonc). */
    public static readonly FulaManifest MANIFEST = LoadManifest.Load<FulaManifest>("languages/fula", "fula.jsonc");

    /** The rule tuples, projected once out of their JSON arrays. ⚠ FILE ORDER IS THE SCAN ORDER — the scan
     *  is longest-match BY POSITION, not by length, so re-sorting would change the reading. */
    public static readonly IReadOnlyList<FulaRule> RULES = MANIFEST.Rules
        .Select(r => new FulaRule(r[0].GetString()!, r[1].GetString()!, r[2].GetBoolean()))
        .ToList();
}

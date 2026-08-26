/**
 * Loads the Zulu data manifest (zulu.jsonc) once and exposes it typed — the longest-match orthography→IPA
 * rule table, the tone-code→Chao map, clause punctuation, the cardinal number words and the `ye-` ordinals.
 * Ported from src/languages/zulu/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Zulu;

public sealed class NounClassMagnitude
{
    public string One { get; init; } = "";
    public string Many { get; init; } = "";
}

public sealed class ZuluNumbersDef
{
    public IReadOnlyList<string> Ku { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Na { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Ama { get; init; } = Array.Empty<string>();
    public string Zero { get; init; } = "";
    public NounClassMagnitude Ten { get; init; } = new();
    public NounClassMagnitude Hundred { get; init; } = new();
    public NounClassMagnitude Thousand { get; init; } = new();
    public NounClassMagnitude Million { get; init; } = new();
}

public sealed class ZuluManifest
{
    /**
     * The longest-match orthography→IPA rule table. The TS type is a tuple, `[string, string, boolean][]`,
     * which JSON writes as an array-of-arrays; System.Text.Json has no tuple deserializer for that shape, so
     * the rows arrive as JsonElement and are projected once into `RULES` below.
     */
    public List<List<System.Text.Json.JsonElement>> Rules { get; init; } = new();
    public IReadOnlyDictionary<string, string> ToneChao { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public ZuluNumbersDef Numbers { get; init; } = new();
    /** The `ye-` ordinal series — the FRACTION denominators. */
    public IReadOnlyDictionary<string, string> OrdinalYe { get; init; } = new Dictionary<string, string>();
}

/** A longest-match orthography→IPA rule (orth, ipa, isVowelNucleus). */
public sealed record Rule(string Orth, string Ipa, bool V);

public static class Manifest
{
    /** The consolidated hand-authored Zulu data tables (see zulu.jsonc). */
    public static readonly ZuluManifest MANIFEST = LoadManifest.Load<ZuluManifest>("languages/zulu", "zulu.jsonc");

    /** The rule tuples, projected once out of their JSON arrays. ⚠ FILE ORDER IS THE SCAN ORDER — the scan is
     *  longest-match BY POSITION in this list, not by string length, so re-sorting changes the reading. */
    public static readonly IReadOnlyList<Rule> RULES = MANIFEST.Rules
        .Select(r => new Rule(r[0].GetString()!, r[1].GetString()!, r[2].GetBoolean()))
        .ToList();
}

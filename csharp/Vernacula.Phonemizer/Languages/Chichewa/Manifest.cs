/**
 * Loads the Chichewa data manifest (chichewa.jsonc) once and exposes it typed — the orthography→IPA
 * grapheme table, clause punctuation and the number words. The greedy longest-match ALGORITHM stays in code.
 * Ported from src/languages/chichewa/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Chichewa;

public sealed class ChichewaNumbersDef
{
    public string[] Units { get; init; } = [];
    public string[] ClassSix { get; init; } = [];
    public string Ten { get; init; } = "";
    public string Tens { get; init; } = "";
    public string Hundred { get; init; } = "";
    public string Hundreds { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Thousands { get; init; } = "";
    public string Million { get; init; } = "";
    public string Millions { get; init; } = "";
    public string Billion { get; init; } = "";
    public string Billions { get; init; } = "";
    public string ClassNineOne { get; init; } = "";
    public string And { get; init; } = "";
}

public sealed class ChichewaManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public ChichewaNumbersDef Numbers { get; init; } = new();
}

public static class Manifest
{
    public static readonly ChichewaManifest MANIFEST =
        LoadManifest.Load<ChichewaManifest>("languages/chichewa", "chichewa.jsonc");

    // Length DESC so the greedy scan tries trigraphs (ng', nkh, ndz) before digraphs before singles.
    // ⚠ STABLE, like JS `Array.prototype.sort`: same-length keys keep the manifest's declaration order.
    public static readonly IReadOnlyList<string> GRAPHEME_KEYS =
        MANIFEST.Graphemes.Keys.OrderByDescending(k => k.Length).ToList();
}

/**
 * Loads the Kamba data manifest (kamba.jsonc) once and exposes it typed — the orthography→IPA
 * grapheme table, clause punctuation and the cardinal word table. There is NO algorithm here: the whole
 * g2p is the greedy longest-match scan (Kamba.cs), the Kikuyu pattern.
 * Ported from src/languages/kamba/manifest.ts — see that file for the data provenance.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Kikuyu;

namespace Vernacula.Phonemizer.Languages.Kamba;

public sealed class KambaManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    /** The cardinal number words (the citation/counting series) — the composer is the shared E5x algorithm. */
    public E5xNumberTable Numbers { get; init; } = new();
}

public static class Manifest
{
    public static readonly KambaManifest MANIFEST =
        LoadManifest.Load<KambaManifest>("languages/kamba", "kamba.jsonc");

    // Length DESC so the greedy scan tries the trigraphs (⟨ng'⟩) before digraphs (prenasal, ⟨th⟩,
    // vowel-length) before the single vowels/consonants.
    // ⚠ STABLE, like JS `Array.prototype.sort`: same-length keys keep the manifest's declaration order.
    public static readonly IReadOnlyList<string> GRAPHEME_KEYS =
        MANIFEST.Graphemes.Keys.OrderByDescending(k => k.Length).ToList();
}

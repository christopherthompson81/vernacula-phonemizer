/**
 * Loads the Kikuyu data manifest (kikuyu.jsonc) once and exposes it typed — the orthography→IPA
 * grapheme table, clause punctuation and the cardinal word table. There is NO algorithm here: the whole
 * g2p is the greedy longest-match scan (Kikuyu.cs).
 * Ported from src/languages/kikuyu/manifest.ts — see that file for the data provenance.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kikuyu;

public sealed class KikuyuManifest
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
    public static readonly KikuyuManifest MANIFEST =
        LoadManifest.Load<KikuyuManifest>("languages/kikuyu", "kikuyu.jsonc");

    // Length DESC so the greedy scan tries the trigraph (⟨ng'⟩) before the digraphs (vowel-length,
    // prenasal, ⟨th ny⟩) before the single vowels/consonants.
    // ⚠ STABLE, like JS `Array.prototype.sort`: same-length keys keep the manifest's declaration order.
    public static readonly IReadOnlyList<string> GRAPHEME_KEYS =
        MANIFEST.Graphemes.Keys.OrderByDescending(k => k.Length).ToList();
}

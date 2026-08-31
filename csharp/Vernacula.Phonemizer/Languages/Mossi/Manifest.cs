/**
 * Loads the Mooré data manifest (mossi.jsonc) once and exposes it typed. Holds the context-free
 * hand-authored DATA: the orthography→IPA grapheme table (ATR-ish vowels ⟨ɛ ɩ ʋ⟩, nasal + length
 * digraphs, ⟨r⟩=ɾ) and the clause punctuation. The consonant-gemination and nasal-assimilation
 * ALGORITHMS stay in code (Mossi.cs).
 * Ported from src/languages/mossi/manifest.ts — see mossi.jsonc for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Mossi;

public sealed record MossiManifest
{
    /** The orthography→IPA grapheme table. */
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();

    /** The vowel letters (plain + -ATR ⟨ɛ ɩ ʋ⟩ + nasal) — a doubled one is length, not a geminate. */
    public IReadOnlyList<string> VowelLetters { get; init; } = [];

    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly MossiManifest MANIFEST = LoadManifest.Load<MossiManifest>("languages/mossi", "mossi.jsonc");

    // Grapheme keys sorted LENGTH DESC so the greedy scan tries the nasal-long/length digraphs (ãa, aa,
    // ɛɛ, ʋʋ…) and the combining-tilde nasals (ɛ̃ ɩ̃ ʋ̃) before the single vowels, and ⟨ny⟩ before ⟨n⟩.
    // ⚠ OrderByDescending is STABLE, matching JS Array.prototype.sort; the dictionary enumerates in
    // document order, which is what Object.keys iterates. (Equal-length keys cannot both match at one
    // position, so the tie order is inert — the length order is the whole rule.)
    public static readonly IReadOnlyList<string> GRAPHEME_KEYS =
        MANIFEST.Graphemes.Keys.OrderByDescending(k => k.Length).ToList();
}

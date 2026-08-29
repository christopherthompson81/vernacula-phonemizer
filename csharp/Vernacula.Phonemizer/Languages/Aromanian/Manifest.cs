/**
 * Loads the Aromanian data manifest (aromanian.jsonc) once at module init and exposes it typed: the
 * digraph table, the vowel letters (the environment for the silent-softener and glide rules), and the
 * single-letter table. The scan and the contextual rules stay in code, in Aromanian.cs.
 * Ported from src/languages/aromanian/aromanian.ts, which reads the same jsonc directly.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Aromanian;

public sealed class AromanianManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];

    /** The jsonc writes the table as an array of [grapheme, ipa] pairs (the TS types it
     *  `[string, string][]`); System.Text.Json binds that shape natively, and DIGRAPHS below turns it
     *  into a lookup. */
    public IReadOnlyList<string[]> Digraphs { get; init; } = [];

    /** The vowel letters — the environment for the silent softener ⟨i⟩ in ⟨ci gi⟩+vowel and the
     *  on/off-glide test. ⟨â î⟩ are absent deliberately: they are the same [ɨ] and take part in neither. */
    public IReadOnlyList<string> VowelLetters { get; init; } = [];

    /** Single letters → IPA. */
    public IReadOnlyDictionary<string, string> Letters { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    /** The hand-authored Aromanian data tables (see aromanian.jsonc). */
    public static readonly AromanianManifest MANIFEST =
        LoadManifest.Load<AromanianManifest>("languages/aromanian", "aromanian.jsonc");

    /** The digraph table as a lookup, keyed by the full grapheme. Every key in the jsonc is exactly two
     *  letters, and the TS scan tests `c === k[0] && nx === k[1]` — for two-letter keys that is whole-key
     *  equality, which is what the lookup does. */
    public static readonly IReadOnlyDictionary<string, string> DIGRAPHS =
        MANIFEST.Digraphs.ToDictionary(p => p[0], p => p[1], StringComparer.Ordinal);

    public static readonly HashSet<string> VOWEL_L =
        new(MANIFEST.VowelLetters, StringComparer.Ordinal);
}

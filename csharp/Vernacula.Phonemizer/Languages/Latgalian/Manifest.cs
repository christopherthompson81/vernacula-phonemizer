/**
 * Loads the Latgalian data manifest (latgalian.jsonc) once and exposes it typed. The grapheme tables, the
 * front-vowel trigger set and the voicing pairs are DATA; the palatalization, ⟨v⟩-coda and voicing-
 * assimilation passes are the algorithm and live in Latgalian.cs.
 *
 * Ported from src/languages/latgalian/latgalian.ts's `LatgalianDef`.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Latgalian;

public sealed record LatgalianDef
{
    /** ⚠ AN ORDERED LIST OF PAIRS, NOT A MAP — the scan tries them in declaration order, and the TS's
     *  `.find()` returns the FIRST match. A dictionary would lose that order. */
    public IReadOnlyList<IReadOnlyList<string>> Digraphs { get; init; } = Array.Empty<IReadOnlyList<string>>();
    /** The vowel LETTERS that palatalize a preceding consonant. */
    public IReadOnlyList<string> FrontVowels { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Voice { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Devoice { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly LatgalianDef MANIFEST =
        LoadManifest.Load<LatgalianDef>("languages/latgalian", "latgalian.jsonc");
}

/**
 * Loads the Nogai data manifest (nogai.jsonc) once and exposes it typed: the consonant/vowel/iotated/
 * digraph → IPA tables and the vowel-letter lookahead set.
 *
 * Nogai (ногай тили) is Kipchak Turkic (Kipchak-Nogai), Cyrillic. It WRITES the uvulars and the velar
 * nasal as digraphs (⟨къ гъ нъ⟩ → [q ʁ ŋ]) and the front vowels as digraphs (⟨аь оь уь⟩ → [æ ø y]), so
 * ⟨к г⟩ are always [k ɡ] — no harmony inference. The position rules (coda ⟨в⟩, ⟨е⟩ iotation, stray ⟨ъ⟩)
 * are code, in Nogai.cs.
 *
 * Ported from src/languages/nogai/nogai.ts's `NogaiDef` — see nogai.jsonc for the single-source note.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Nogai;

public sealed record NogaiDef
{
    /** Plain (context-free) single-letter consonants. ⟨в⟩ and the digraphs are handled in the scan. */
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();

    /** Simple vowels → IPA. ⟨ы⟩ is the back unrounded [ɯ]; ⟨э⟩ merges with ⟨е⟩ → [e]. */
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();

    /** Every letter that writes a vowel — the lookahead for the ⟨в⟩→[w] coda test. */
    public IReadOnlyList<string> VowelLetters { get; init; } = [];

    /** Iotated vowels → glide + vowel. */
    public IReadOnlyDictionary<string, string> Iotated { get; init; } = new Dictionary<string, string>();

    /** Two-character digraphs, checked before the single-letter maps. */
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly NogaiDef DEF = LoadManifest.Load<NogaiDef>("languages/nogai", "nogai.jsonc");

    /** The vowel letters as a set — the one-character lookahead the coda-⟨в⟩ test reads. */
    public static readonly IReadOnlySet<string> CYR_VOWEL =
        new HashSet<string>(DEF.VowelLetters, StringComparer.Ordinal);
}

/**
 * Loads the Faroese data manifest (faroese.jsonc) once at module init and exposes it typed: the vowel
 * grapheme table (grapheme → [long, short] IPA quality), the base consonant table (voicing-neutralised),
 * and the letter sets the code rules read — the affricating front vowels, the two neighbour classes that
 * decide the intervocalic ⟨g ð⟩ glide, the skerping remaps, and the pre-nasal shift.
 * Ported from src/languages/faroese/faroese.ts, which reads the same jsonc directly.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Faroese;

public sealed class FaroeseManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];

    /** Vowel graphemes → [long, short] IPA quality. The digraphs ⟨ei ey oy⟩ scan first (longest match). */
    public IReadOnlyDictionary<string, string[]> Vowels { get; init; } = new Dictionary<string, string[]>();

    /** Base consonant graphemes → IPA (⟨b d g⟩→[p t k]; the context rules run in passes in Faroese.cs). */
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();

    /** Front vowel graphemes that affricate a preceding ⟨g k⟩. ⟨ø⟩ is deliberately absent. */
    public IReadOnlyList<string> AffricatingVowels { get; init; } = [];

    /** The intervocalic-glide neighbours: a front one makes the glide [j], a round one [v]. */
    public IReadOnlyList<string> FrontGlideVowels { get; init; } = [];
    public IReadOnlyList<string> RoundGlideVowels { get; init; } = [];

    /** The SKERPING vowel remap before ⟨gv⟩. */
    public IReadOnlyDictionary<string, string> Skerping { get; init; } = new Dictionary<string, string>();

    /** The SKERPING remap before ⟨ggj⟩ (the í/ý offglide drops to plain [ʊ]). */
    public IReadOnlyDictionary<string, string> SkerpingGgj { get; init; } = new Dictionary<string, string>();

    /** The short-vowel shift before ⟨ng nk⟩. */
    public IReadOnlyDictionary<string, string> Prenasal { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    /** The hand-authored Faroese data tables (see faroese.jsonc). */
    public static readonly FaroeseManifest MANIFEST =
        LoadManifest.Load<FaroeseManifest>("languages/faroese", "faroese.jsonc");

    // TS `Object.keys(VOWEL).sort((a, b) => b.length - a.length)`: digraphs first, and the sort is STABLE,
    // so equal-length keys keep the manifest's insertion order — `Dictionary` preserves it (nothing is removed).
    public static readonly IReadOnlyList<string> VOWEL_KEYS =
        MANIFEST.Vowels.Keys.OrderByDescending(k => k.Length).ToList();

    public static readonly IReadOnlySet<string> FRONT_V =
        new HashSet<string>(MANIFEST.AffricatingVowels, StringComparer.Ordinal);

    public static readonly IReadOnlySet<string> FRONT_GLIDE =
        new HashSet<string>(MANIFEST.FrontGlideVowels, StringComparer.Ordinal);

    public static readonly IReadOnlySet<string> ROUND_GLIDE =
        new HashSet<string>(MANIFEST.RoundGlideVowels, StringComparer.Ordinal);
}

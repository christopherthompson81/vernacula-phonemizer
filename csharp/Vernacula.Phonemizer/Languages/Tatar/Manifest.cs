/**
 * Loads the Tatar data manifest (tatar.jsonc) once at module init and exposes it typed: the context-free
 * consonant table, the vowel table, the iotated vowels, and the three letter sets the code rules read —
 * the vowel letters (the ⟨е⟩ iotation environment) and the two harmony classes that drive the ⟨к г⟩
 * uvular backing and the ⟨а⟩ [a]/[ɑ] fronting.
 * Ported from src/languages/tatar/tatar.ts, which reads the same jsonc directly.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Tatar;

public sealed class TatarManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];

    /** Context-free consonants → IPA. ⟨к г⟩ (harmony-conditioned) are NOT here — they are code. */
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();

    /** The simple vowels. ⟨а⟩'s [a]/[ɑ] split and ⟨е⟩'s iotation carry position rules on top, in Tatar.cs. */
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();

    /** Iotated vowels → glide + vowel. */
    public IReadOnlyDictionary<string, string> Iotated { get; init; } = new Dictionary<string, string>();

    /** Every Cyrillic letter that writes a vowel — the environment for the ⟨е⟩→[je] iotation. */
    public IReadOnlyList<string> VowelLetters { get; init; } = [];

    /** ⚠ THE HARMONY CLASSES, driving two different rules: the NEAREST-vowel scan that backs ⟨к г⟩ to
     *  [q ʁ], and the whole-word test that fronts ⟨а⟩ to [a]. Both lists must be complete. */
    public IReadOnlyList<string> BackVowels { get; init; } = [];
    public IReadOnlyList<string> FrontVowels { get; init; } = [];
}

public static class Manifest
{
    /** The hand-authored Tatar data tables (see tatar.jsonc). */
    public static readonly TatarManifest MANIFEST =
        LoadManifest.Load<TatarManifest>("languages/tatar", "tatar.jsonc");

    public static readonly IReadOnlySet<string> CYR_VOWEL =
        new HashSet<string>(MANIFEST.VowelLetters, StringComparer.Ordinal);
    public static readonly IReadOnlySet<string> BACK =
        new HashSet<string>(MANIFEST.BackVowels, StringComparer.Ordinal);
    public static readonly IReadOnlySet<string> FRONT =
        new HashSet<string>(MANIFEST.FrontVowels, StringComparer.Ordinal);
}

/**
 * Loads the Chuvash data manifest (chuvash.jsonc) once at module init and exposes it typed: the onset
 * consonant table, the voiced-allophone table, the vowel table, the iotated vowels, and the three letter
 * sets the code rules read — the voicing triggers (nasals+glide, liquids) and the vowel letters (the ⟨е⟩
 * iotation environment).
 * Ported from src/languages/chuvash/chuvash.ts, which reads the same jsonc directly.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Chuvash;

public sealed class ChuvashManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];

    /** Onset (default, pre-voicing) consonants → IPA. */
    public IReadOnlyDictionary<string, string> Onset { get; init; } = new Dictionary<string, string>();

    /** The intervocalic/post-sonorant VOICED allophone of each voiceless obstruent, keyed by ONSET IPA. */
    public IReadOnlyDictionary<string, string> Voiced { get; init; } = new Dictionary<string, string>();

    /** The vowels. ⟨ӑ⟩→[ə], ⟨ӗ⟩→[ɘ] are the two REDUCED vowels. */
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();

    /** Iotated vowels → glide + vowel. */
    public IReadOnlyDictionary<string, string> Iotated { get; init; } = new Dictionary<string, string>();

    /** The voicing triggers that count UNCONDITIONALLY (the nasals + glide), like an intervocalic vowel. */
    public IReadOnlyList<string> VoicingSonorants { get; init; } = [];

    /** The liquids — they trigger voicing only before a FULL vowel. */
    public IReadOnlyList<string> Liquids { get; init; } = [];

    /** Every letter that writes a vowel, including ⟨ӑ ӗ ӳ⟩ — the environment for the ⟨е⟩ iotation. */
    public IReadOnlyList<string> VowelLetters { get; init; } = [];
}

public static class Manifest
{
    /** The hand-authored Chuvash data tables (see chuvash.jsonc). */
    public static readonly ChuvashManifest MANIFEST =
        LoadManifest.Load<ChuvashManifest>("languages/chuvash", "chuvash.jsonc");

    public static readonly IReadOnlySet<string> CYR_VOWEL =
        new HashSet<string>(MANIFEST.VowelLetters, StringComparer.Ordinal);

    // Voicing triggers (before a vowel). The nasals ⟨н м ҥ⟩ and the glide ⟨й⟩ trigger voicing
    // UNCONDITIONALLY; the liquids ⟨р л⟩ only before a FULL vowel.
    public static readonly IReadOnlySet<string> NASAL_GLIDE =
        new HashSet<string>(MANIFEST.VoicingSonorants, StringComparer.Ordinal);

    public static readonly IReadOnlySet<string> LIQUID =
        new HashSet<string>(MANIFEST.Liquids, StringComparer.Ordinal);

    /** The reduced vowels — never stressed. */
    public static readonly IReadOnlySet<string> REDUCED =
        new HashSet<string>(["ə", "ɘ"], StringComparer.Ordinal);
}

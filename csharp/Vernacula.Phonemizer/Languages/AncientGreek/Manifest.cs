/**
 * Loads the Ancient Greek data manifest (ancientgreek.jsonc): the letter values — vowels as [short, long]
 * pairs, consonants, diphthongs — and the two context lists the scan tests against.
 * Ported from src/languages/ancientgreek/ancientgreek.ts's `loadManifest` call; see the jsonc for the
 * encyclopedic record and the Vox Graeca sourcing.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.AncientGreek;

public sealed class AncientGreekDef
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];

    /** Base vowel letter → [short, long]. */
    public IReadOnlyDictionary<string, string[]> Vowels { get; init; } = new Dictionary<string, string[]>();

    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();

    /** The velar PHONES before which ⟨γ⟩ is the nasal [ŋ]. */
    public IReadOnlyList<string> Velars { get; init; } = [];

    /** The voiced consonant LETTERS that assimilate a preceding ⟨σ ς⟩ to [z]. */
    public IReadOnlyList<string> VoicedAfterSigma { get; init; } = [];

    public IReadOnlyDictionary<string, string> Diphthongs { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly AncientGreekDef MANIFEST =
        LoadManifest.Load<AncientGreekDef>("languages/ancientgreek", "ancientgreek.jsonc");
}

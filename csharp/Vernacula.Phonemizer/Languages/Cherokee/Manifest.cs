/**
 * Loads the Cherokee data manifest (cherokee.jsonc) once at module init and exposes it typed: the 85
 * syllabary values in U+13A0 order, the onset → IPA map and the six vowels. The char → IPA table itself is
 * BUILT from those (Cherokee.cs), not tabulated, so the syllabary's own ordering is the only index.
 * Ported from src/languages/cherokee/cherokee.ts, which reads the same jsonc directly.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Cherokee;

public sealed class CherokeeManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];

    /** The 85 syllabary values in U+13A0 order, as onset+vowel spellings. Bare "s" (U+13CD) and the
     *  obsolete "nah" (U+13C0, now written ⟨na⟩) are the only non-CV entries. */
    public IReadOnlyList<string> Syllables { get; init; } = [];

    /** Syllable ONSET → IPA. Voiceless-unaspirated baseline; the aspirated split-cell onsets emit [kʰ tʰ]. */
    public IReadOnlyDictionary<string, string> Onsets { get; init; } = new Dictionary<string, string>();

    /** The six vowels — a e i o u plus ⟨v⟩→[ə̃] (nasal mid-central). */
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly CherokeeManifest MANIFEST =
        LoadManifest.Load<CherokeeManifest>("languages/cherokee", "cherokee.jsonc");
}

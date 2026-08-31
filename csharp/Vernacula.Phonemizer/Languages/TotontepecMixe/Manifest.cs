/**
 * Loads the Totontepec Mixe data manifest (totontepecmixe.jsonc) once and exposes it typed: the
 * longest-first digraph list, the vowel and consonant grapheme tables, and the three sets the allophony
 * passes read (the two voicing nasals, the velars, and the post-nasal voicing map).
 * Ported from src/languages/totontepecmixe/totontepecmixe.ts, which reads the same jsonc directly.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.TotontepecMixe;

public sealed class TotontepecMixeDef
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];

    /** ⚠ ORDERED, LONGEST-FIRST — the scan is a first-match `find` over this list, so file order is the
     *  algorithm. A `[string, string][]` in the TS, so JSON gives array-of-arrays. */
    public IReadOnlyList<IReadOnlyList<string>> Digraphs { get; init; } = [];

    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();

    /** ⚠ POST-NASAL VOICING fires after these two ONLY — the rule is conditioned on ⟨m n⟩, not on
     *  nasality in general, which is why the emitted [ŋ] is absent here on purpose. */
    public IReadOnlyList<string> VoicingNasals { get; init; } = [];
    /** The velars, for the ⟨n⟩→[ŋ] pass. */
    public IReadOnlyList<string> Velars { get; init; } = [];
    /** Post-nasal voicing (Crawford §1.121d), keyed by the plain IPA. */
    public IReadOnlyDictionary<string, string> PostNasalVoice { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly TotontepecMixeDef DEF =
        LoadManifest.Load<TotontepecMixeDef>("languages/totontepecmixe", "totontepecmixe.jsonc");

    /** The digraph list projected once out of its array-of-arrays JSON shape, order preserved. */
    public static readonly (string Key, string Ph)[] DIGRAPHS =
        DEF.Digraphs.Select(d => (d[0], d[1])).ToArray();

    public static readonly IReadOnlySet<string> NASAL =
        new HashSet<string>(DEF.VoicingNasals, StringComparer.Ordinal);
    public static readonly IReadOnlySet<string> VELAR =
        new HashSet<string>(DEF.Velars, StringComparer.Ordinal);
}

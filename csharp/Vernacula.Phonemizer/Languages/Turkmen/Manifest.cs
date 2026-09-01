/**
 * Loads the Turkmen data manifest (turkmen.jsonc) once and exposes it typed. The TS declares `TurkmenDef`
 * inline in turkmen.ts and loads the `numbers` slice separately in numbers.ts; C# names both here.
 * Ported from src/languages/turkmen/turkmen.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Turkmen;

public sealed class TurkmenDef
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];

    /** Empty in this language — Turkmen's Latin orthography is near-phonemic, one sound per letter. */
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    /** Single graphemes → IPA, including the interdental hallmark ⟨s⟩→[θ] / ⟨z⟩→[ð]. */
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();
    /** The NASALS, for the maximal-onset stress scan (sonority 3) and its nasal+stop test. */
    public IReadOnlyList<string> Nasals { get; init; } = [];
    /** units[0..9], tens{"10".."90"} — ⚠ Turkic: 10 IS a tens entry — magnitudes{}. */
    public NumbersDef Numbers { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly TurkmenDef DEF = LoadManifest.Load<TurkmenDef>("languages/turkmen", "turkmen.jsonc");

    public static readonly IReadOnlySet<string> NASAL =
        new HashSet<string>(DEF.Nasals, StringComparer.Ordinal);
}

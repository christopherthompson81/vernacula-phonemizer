/**
 * Loads the Latin data manifest (latin.jsonc): the short/long/hiatus-tense vowel tables, the consonant
 * table, and the three phone classes the context rules are keyed on (velars, mutae, liquids).
 * Ported from src/languages/latin/latin.ts's `loadManifest` call — see the jsonc for the encyclopedic
 * record and the Vox Latina sourcing.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Latin;

public sealed class LatinDef
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];

    /** Short vowel LETTER → its lax phone. */
    public IReadOnlyDictionary<string, string> Short { get; init; } = new Dictionary<string, string>();

    /** Macron vowel LETTER → its long phone. */
    public IReadOnlyDictionary<string, string> Long { get; init; } = new Dictionary<string, string>();

    /** The same short letters → the TENSE quality they take in hiatus. */
    public IReadOnlyDictionary<string, string> Tense { get; init; } = new Dictionary<string, string>();

    /** Every letter that writes a vowel — the scan's syllable-boundary test. */
    public IReadOnlyList<string> VowelLetters { get; init; } = [];

    /** The PHONES before which ⟨n⟩ is [ŋ]. */
    public IReadOnlyList<string> Velars { get; init; } = [];

    /** Muta cum liquida: the obstruents that may onset the ultima with a following liquid. */
    public IReadOnlyList<string> Mutae { get; init; } = [];

    public IReadOnlyList<string> Liquids { get; init; } = [];

    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly LatinDef MANIFEST = LoadManifest.Load<LatinDef>("languages/latin", "latin.jsonc");
}

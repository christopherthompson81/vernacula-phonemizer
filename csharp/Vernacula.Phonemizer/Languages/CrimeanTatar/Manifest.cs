/**
 * Loads the Crimean Tatar data manifest (crimeantatar.jsonc) once at module init and exposes it typed: the
 * single-letter table (no digraphs — ⟨ç ş ñ ğ⟩ are single letters) and the vowel letters, which are the
 * environment for the one context rule (⟨v⟩→[w] in a post-vocalic coda). The scan, that rule and the
 * dotless-I casing stay in code.
 * Ported from src/languages/crimeantatar/crimeantatar.ts, which reads the same jsonc directly.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.CrimeanTatar;

public sealed class CrimeanTatarManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];

    /** The VOWEL LETTERS of the Latin orthography, including the front/round pairs ⟨ı i⟩, ⟨o ö⟩, ⟨u ü⟩ and
     *  the soft ⟨â⟩ — the environment for the ⟨v⟩→[w] coda rule. */
    public IReadOnlyList<string> VowelLetters { get; init; } = [];

    /** Single letters (no digraphs). ⟨v⟩ is context-dependent and handled in the scan. */
    public IReadOnlyDictionary<string, string> Letters { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly CrimeanTatarManifest MANIFEST =
        LoadManifest.Load<CrimeanTatarManifest>("languages/crimeantatar", "crimeantatar.jsonc");

    /** The Latin vowel letters — the ⟨v⟩→[w] coda context. ⚠ The TS names this `CYR_VOWEL`, a name
     *  inherited from the sibling Turkic engines; Crimean Tatar is written in Latin and always has been. */
    public static readonly IReadOnlySet<string> VOWEL =
        new HashSet<string>(MANIFEST.VowelLetters, StringComparer.Ordinal);
}

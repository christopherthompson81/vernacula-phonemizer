/**
 * Loads the Kyrgyz data manifest (kyrgyz.jsonc) once and exposes it typed: the vowel/iotated/consonant →
 * IPA tables, the back-vowel set, the cardinal number atoms, the letter-name table and clause punctuation.
 * DATA only; the ALGORITHMS that read them stay in code (Kyrgyz.cs's harmony scan and number compositor;
 * Normalize.cs's rules and suffix morphology).
 * Ported from src/languages/kyrgyz/manifest.ts — see that file for the rationale (its own module because
 * both kyrgyz.ts and normalize.ts need it).
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kyrgyz;

public sealed class KyrgyzManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];

    /** Plain vowel letters → IPA. A doubled vowel → [Vː] is handled in code. */
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();

    /** The BACK-harmony vowels as one string (аоуы), spread to a set in Manifest.BACK. */
    public string BackVowels { get; init; } = "";

    /** Iotated letters (Russian loans) → a fixed IPA sequence. */
    public IReadOnlyDictionary<string, string> Iotated { get; init; } = new Dictionary<string, string>();

    /** Consonant letters → IPA (context-free). ⟨к г л⟩ are handled in code (velar/uvular + dark-⟨л⟩). */
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();

    /** Cardinal number atoms — canonical NumbersDef schema (units[], tens{"10".."90"}, magnitudes). */
    public NumbersDef Numbers { get; init; } = new();

    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();

    /** Cyrillic letter names for the shared initialism seam (core/initialisms.ts). */
    public IReadOnlyDictionary<string, string> LetterNames { get; init; } = new Dictionary<string, string>();

    /** Acronyms spelled letter-by-letter although their lowercase form is phonotactically readable. EMPTY. */
    public IReadOnlyList<string> AcronymLetters { get; init; } = [];
}

public static class Manifest
{
    /** The hand-authored Kyrgyz data tables (see kyrgyz.jsonc). */
    public static readonly KyrgyzManifest DEF =
        LoadManifest.Load<KyrgyzManifest>("languages/kyrgyz", "kyrgyz.jsonc");

    /** The back-harmony vowels, read once and used by the velar/uvular + dark-⟨л⟩ harmony scan. */
    public static readonly IReadOnlySet<string> BACK =
        new HashSet<string>(Js.CodePoints(DEF.BackVowels), StringComparer.Ordinal);
}

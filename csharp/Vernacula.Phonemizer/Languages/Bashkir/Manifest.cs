/**
 * Loads the Bashkir data manifest (bashkir.jsonc) once at module init and exposes it typed: the
 * context-free consonant table, the vowel table (the Bashkir vowel shift), the iotated vowels, and the
 * three letter sets the code rules read — the vowel letters (the ⟨у ү⟩ glide environment), the
 * back-harmony vowels (which govern the dark ⟨л⟩ AND one side of the loan test), and the Bashkir-only
 * letters plus the short front list the RUSSIAN-LOAN router uses.
 * Ported from src/languages/bashkir/bashkir.ts, which reads the same jsonc directly.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Bashkir;

public sealed class BashkirManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];

    /** Context-free consonants → IPA. ⟨л⟩ (dark/clear by harmony) is NOT here — it is code. */
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();

    /** The vowels (the Bashkir shift). ⟨у ү е⟩ carry position rules on top, in Bashkir.cs. */
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();

    /** Iotated vowels → glide + vowel. */
    public IReadOnlyDictionary<string, string> Iotated { get; init; } = new Dictionary<string, string>();

    /** Every Cyrillic letter that writes a vowel — the environment for the ⟨у⟩/⟨ү⟩ glide test. */
    public IReadOnlyList<string> VowelLetters { get; init; } = [];

    /** The BACK-harmony vowels. Harmony is a whole-word property, so one of these anywhere makes the word
     *  a back word — which decides the dark ⟨л⟩→[ɫ] against the clear [l]. */
    public IReadOnlyList<string> BackVowels { get; init; } = [];

    /** The letters Russian does not have. Always harmonic, so ONE of them vetoes the loan test. */
    public IReadOnlyList<string> BashkirLetters { get; init; } = [];

    /** ⚠ The front side of the harmony-violation test, and deliberately NOT the mirror of BackVowels —
     *  ⟨и⟩ is neutral and ⟨ә ө ү⟩ are already Bashkir-only letters. See the jsonc. */
    public IReadOnlyList<string> LoanFrontVowels { get; init; } = [];
}

public static class Manifest
{
    /** The hand-authored Bashkir data tables (see bashkir.jsonc). */
    public static readonly BashkirManifest MANIFEST =
        LoadManifest.Load<BashkirManifest>("languages/bashkir", "bashkir.jsonc");

    public static readonly IReadOnlySet<string> CYR_VOWEL =
        new HashSet<string>(MANIFEST.VowelLetters, StringComparer.Ordinal);

    /** The back vowels, read once and used twice — the dark-⟨л⟩ rule and the loan test's back side. The TS
     *  aliases the same Set for both (`const BACK_V = BACK`) rather than keeping two copies. */
    public static readonly IReadOnlySet<string> BACK =
        new HashSet<string>(MANIFEST.BackVowels, StringComparer.Ordinal);

    public static readonly IReadOnlySet<string> BASHKIR_LETTER =
        new HashSet<string>(MANIFEST.BashkirLetters, StringComparer.Ordinal);

    public static readonly IReadOnlySet<string> FRONT_V =
        new HashSet<string>(MANIFEST.LoanFrontVowels, StringComparer.Ordinal);
}

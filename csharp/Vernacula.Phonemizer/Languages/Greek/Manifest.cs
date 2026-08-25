/**
 * Loads the Modern Greek data manifest (greek.jsonc) once at module init.
 * Ported from src/languages/greek/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Greek;

public sealed class GreekNumbersDef
{
    public IReadOnlyList<string> Units { get; init; } = Array.Empty<string>();
    public string Ten { get; init; } = "";
    public IReadOnlyList<string> Tens { get; init; } = Array.Empty<string>();
    public string Hundred { get; init; } = "";
    public IReadOnlyList<string> Hundreds { get; init; } = Array.Empty<string>();
    public string Thousand { get; init; } = "";
    public string And { get; init; } = "";
}

public sealed class GreekOrdinals
{
    public string[] Units { get; init; } = [];
    /** ⚠ All OXYTONE, which selects the second column of `Endings`. */
    public string[] Tens { get; init; } = [];
    public IReadOnlyDictionary<string, string[]> Endings { get; init; } = new Dictionary<string, string[]>();
}

public sealed class GreekClock
{
    public string[] HoursFeminine { get; init; } = [];
    public string[] MinuteUnits { get; init; } = [];
    public string[] MinuteTeens { get; init; } = [];
    public string[] MinuteTens { get; init; } = [];
}

public sealed class GreekManifest
{
    /** Accented vowel → its bare letter. ⚠ Greek.cs DERIVES the stressed-vowel set from these keys. */
    public IReadOnlyDictionary<string, string> Tonos { get; init; } = new Dictionary<string, string>();
    /** ⚠ Synizesis palatalises λ and ν, which `Palatal` does not cover; κ/γ/χ come from `Palatal`. */
    public IReadOnlyDictionary<string, string> SynizesisPalatal { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Homoglyphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> LetterNames { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> WordAcronyms { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> MixedCaseInitialisms { get; init; } = new Dictionary<string, string>();
    public GreekOrdinals Ordinals { get; init; } = new();
    public IReadOnlyDictionary<string, int> AlphabeticNumerals { get; init; } = new Dictionary<string, int>();
    /** ⚠ Hours are FEMININE and minutes NEUTER — two series for the same digits. */
    public GreekClock Clock { get; init; } = new();
    /** ⚠ CASE-SENSITIVE: π.Χ. is "before Christ", π.χ. is "for example". */
    public IReadOnlyDictionary<string, string> Abbreviations { get; init; } = new Dictionary<string, string>();

    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    /** Voiceless consonant letters — they take the voiceless glide [ç] under palatalisation. */
    public IReadOnlyList<string> Voiceless { get; init; } = Array.Empty<string>();
    /** Letters AND digraphs that make ⟨αυ ευ⟩ voiced ([av ev] rather than [af ef]). */
    public IReadOnlyList<string> AuVoiced { get; init; } = Array.Empty<string>();
    /** The shorter class that voices a preceding ⟨σ⟩ to [z]. */
    public IReadOnlyList<string> SigmaVoiced { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> VowelDigraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ConsonantDigraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Palatal { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public GreekNumbersDef Numbers { get; init; } = new();
    /** The shared symbol tier's data — see the jsonc, where the evidence lives. */
    public GreekSymbols Symbols { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Modern Greek data tables (see greek.jsonc). */
    public static readonly GreekManifest MANIFEST =
        LoadManifest.Load<GreekManifest>("languages/greek", "greek.jsonc");
}

public sealed class GreekSymbols
{
    public IReadOnlyList<string> Percent { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Currency { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Units { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public ExponentWordsDef ExponentWords { get; init; } = new();
    public IReadOnlyList<string> Magnitudes { get; init; } = Array.Empty<string>();
    public string Ampersand { get; init; } = "";
    public MultiplyDef Multiply { get; init; } = null!;
}

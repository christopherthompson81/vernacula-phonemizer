/**
 * Loads the Russian data manifest (russian.jsonc) once at module init and exposes it typed. Holds the context-
 * free hand-authored DATA: the hard/soft consonant table, the letter class sets, the voicing-pair maps + obstruent
 * sets, the regressive-softening dental classes, the genitive-ɡ adverb list, the closed-class irregulars, the
 * adjective-ending → lemma table, clause punctuation, and the number words. The ALGORITHMS that read them stay in
 * code (g2p.ts / russian.ts / numbers.ts): the Cyrillic scan, vowel reduction, voicing assimilation, stress
 * inference, and the number compositor. The lexical stress + hard-е dictionaries stay in sibling .tsv files.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Russian;

public sealed class AdjectiveEnding
{
    public string End { get; init; } = "";
    /** "hard" | "soft" */
    public string Type { get; init; } = "";
}

public sealed class AdjectiveStressDef
{
    public IReadOnlyList<string> HardLemmas { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> SoftLemmas { get; init; } = Array.Empty<string>();
    public IReadOnlyList<AdjectiveEnding> Endings { get; init; } = Array.Empty<AdjectiveEnding>();
}

public sealed class ThousandFeminine
{
    public string One { get; init; } = "";
    public string Two { get; init; } = "";
}

public sealed class RussianNumbersDef
{
    public IReadOnlyList<string> Ones { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Tens { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Hundreds { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Million { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Thousand { get; init; } = Array.Empty<string>();
    public ThousandFeminine ThousandFeminine { get; init; } = new();
    public string DecimalConnector { get; init; } = "";
}

public sealed class RussianManifest
{
    /** Acronyms read letter-by-letter; see russian.jsonc. */
    public IReadOnlyList<string> AcronymLetters { get; init; } = Array.Empty<string>();
    public string VowelLetters { get; init; } = "";
    public IReadOnlyDictionary<string, string[]> Consonants { get; init; } = new Dictionary<string, string[]>();
    public IReadOnlyList<string> AlwaysHard { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> AlwaysSoft { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> SoftVowels { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> IotatedVowels { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Devoice { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Voice { get; init; } = new Dictionary<string, string>();
    public IReadOnlyList<string> VoicelessObstruents { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> VoicedObstruents { get; init; } = Array.Empty<string>();
    public string SoftenTargets { get; init; } = "";
    public string SoftenTriggers { get; init; } = "";
    public IReadOnlyList<string> GenitiveKeepG { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Irregulars { get; init; } = new Dictionary<string, string>();
    public AdjectiveStressDef AdjectiveStress { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public RussianNumbersDef Numbers { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Russian data tables (see russian.jsonc). */
    public static readonly RussianManifest MANIFEST =
        LoadManifest.Load<RussianManifest>("languages/russian", "russian.jsonc");
}

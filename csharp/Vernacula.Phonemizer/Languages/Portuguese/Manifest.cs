/**
 * Loads the European Portuguese data manifest (portuguese.jsonc) once at module init and exposes it typed. Holds
 * the context-free hand-authored DATA: accent letter classes, the vowel-letter→IPA table, the reduction and
 * nasalization maps, the voiced-consonant / liquid sets, the function-word list, clause punctuation, and the
 * number words. The ALGORITHMS that read them stay in code (g2p.ts / portuguese.ts / numbers.ts): the scan,
 * stress, reduction pass, sibilant voicing, and the cardinal compositor. The lexical correction table stays in
 * the sibling lexicon.tsv / lexicon-manual.tsv, which the manifest only references.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Portuguese;

public sealed class PortugueseAccents
{
    public IReadOnlyDictionary<string, string> ToBase { get; init; } = new Dictionary<string, string>();
    public string AcuteGrave { get; init; } = "";
    public string Circumflex { get; init; } = "";
    public string Tilde { get; init; } = "";
}

public sealed class PortugueseNumberData
{
    public IReadOnlyList<string> Small { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Tens { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Hundreds { get; init; } = Array.Empty<string>();
    public string HundredExact { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
    public string MillionPlural { get; init; } = "";
    public string Connector { get; init; } = "";
    public string DecimalConnector { get; init; } = "";
}

public sealed class PortugueseManifest
{
    /** Acronyms read letter-by-letter; see portuguese.jsonc. */
    public IReadOnlyList<string> AcronymLetters { get; init; } = Array.Empty<string>();
    public PortugueseAccents Accents { get; init; } = new();
    public string VowelLetters { get; init; } = "";
    public string FrontLetters { get; init; } = "";
    public IReadOnlyDictionary<string, string> VowelIpa { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Reduce { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Nasal { get; init; } = new Dictionary<string, string>();
    public IReadOnlyList<string> VoicedConsonants { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Liquids { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> FunctionWords { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public PortugueseNumberData Numbers { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored European Portuguese data tables (see portuguese.jsonc). */
    public static readonly PortugueseManifest MANIFEST =
        LoadManifest.Load<PortugueseManifest>("languages/portuguese", "portuguese.jsonc");
}

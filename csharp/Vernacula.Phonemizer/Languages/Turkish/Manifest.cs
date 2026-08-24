/**
 * Loads the Turkish data manifest (turkish.jsonc) once at module init and exposes it typed. Holds the context-
 * free hand-authored DATA: the vowel letter→IPA table + harmony classes, the circumflex fold, the consonant
 * table + geminating-stop set, clause punctuation, and the number words. The ALGORITHMS that read them stay in
 * code (g2p.ts / turkish.ts / numbers.ts): the scan (palatalization, dark-l, ğ), stress + suffix morphology, and
 * the cardinal compositor. Stress exceptions stay in the sibling stress.tsv, which the manifest only references.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Turkish;

public sealed class TurkishVowels
{
    public IReadOnlyDictionary<string, string> Ipa { get; init; } = new Dictionary<string, string>();
    public string[] Front { get; init; } = [];
    public string[] FrontUnround { get; init; } = [];
    public string[] Back { get; init; } = [];
}

public sealed class TurkishNumbersDef
{
    public string[] Ones { get; init; } = [];
    public string[] Tens { get; init; } = [];
    public string[] Scales { get; init; } = [];
    public string Hundred { get; init; } = "";
    public string Zero { get; init; } = "";
    public string DecimalConnector { get; init; } = "";
}

public sealed class TurkishManifest
{
    public TurkishVowels Vowels { get; init; } = new();
    public IReadOnlyDictionary<string, string> CircumflexFold { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public string[] Geminate { get; init; } = [];
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public TurkishNumbersDef Numbers { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Turkish data tables (see turkish.jsonc). */
    public static readonly TurkishManifest MANIFEST = LoadManifest.Load<TurkishManifest>("languages/turkish", "turkish.jsonc");
}

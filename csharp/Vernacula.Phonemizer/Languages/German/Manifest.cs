/**
 * Loads the German data manifest (german.jsonc) once at module init and exposes it typed. The hand-authored
 * DATA tables (vowel length maps, final-devoicing pairs, exception word-lists, clause punctuation, the
 * morphology tables, number words) live in the JSONC; the ALGORITHMS that consume them stay in the sibling
 * modules (g2p.ts, german.ts, morphology.ts, numbers.ts).
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.German;

public sealed class GermanVowelTables
{
    public IReadOnlyDictionary<string, string> Long { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Short { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> LongOf { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ShortOf { get; init; } = new Dictionary<string, string>();
}

public sealed class GermanMorphologyData
{
    public IReadOnlyList<string> PrefixUnstressed { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> PrefixStressed { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Suffixes { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> VowelInitialSuffixes { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> AmbiguousPrefixes { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> LinkingElements { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> ValidOnsets { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> PrefixIpa { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> SuffixIpa { get; init; } = new Dictionary<string, string>();
    public IReadOnlyList<string> StKeepWords { get; init; } = Array.Empty<string>();
}

public sealed class GermanMillion
{
    public string Sg { get; init; } = "";
    public string Pl { get; init; } = "";
}

public sealed class GermanNumberData
{
    public IReadOnlyList<string> Ones { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Tens { get; init; } = Array.Empty<string>();
    public string CompoundOne { get; init; } = "";
    public string Connector { get; init; } = "";
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public GermanMillion Million { get; init; } = new();
}

public sealed class GermanManifest
{
    /** Acronyms read letter-by-letter; see german.jsonc. */
    public IReadOnlyList<string> AcronymLetters { get; init; } = Array.Empty<string>();
    public string VowelChars { get; init; } = "";
    public GermanVowelTables Vowels { get; init; } = new();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> VoicedFinal { get; init; } = new Dictionary<string, string>();
    public IReadOnlyList<string> ShortMonosyllables { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> LongCh { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public GermanMorphologyData Morphology { get; init; } = new();
    public GermanNumberData Numbers { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored German data tables (see german.jsonc). */
    public static readonly GermanManifest MANIFEST =
        LoadManifest.Load<GermanManifest>("languages/german", "german.jsonc");
}

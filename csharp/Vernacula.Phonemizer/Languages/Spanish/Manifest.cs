/**
 * Loads the Spanish data manifest (spanish.jsonc) once at module init and exposes it typed. Holds the context-
 * free hand-authored DATA: the vowel classes, the accented-vowel→base map, the nasal + spirantization sets, the
 * function-word list, clause punctuation, and the number words. The ALGORITHMS that read them stay in code
 * (g2p.ts / spanish.ts / numbers.ts): the scan, glide classification, spirantization, stress, and the compositor.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Spanish;

public sealed class SpanishVowels
{
    public string Strong { get; init; } = "";
    public string WeakUnaccented { get; init; } = "";
    public string WeakAccented { get; init; } = "";
    public string Front { get; init; } = "";
}

public sealed class SpanishScale
{
    public double Value { get; init; }
    public string One { get; init; } = "";
    public string Many { get; init; } = "";
}

public sealed class SpanishNumbers
{
    public IReadOnlyList<string> Ones { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Tens { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Hundreds { get; init; } = Array.Empty<string>();
    public string HundredExact { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Connector { get; init; } = "";
    public string DecimalConnector { get; init; } = "";
    public IReadOnlyList<SpanishScale> Scales { get; init; } = Array.Empty<SpanishScale>();
}

public sealed class SpanishManifest
{
    public SpanishVowels Vowels { get; init; } = new();
    /** Acronyms read letter-by-letter; see spanish.jsonc. */
    public IReadOnlyList<string> AcronymLetters { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Accents { get; init; } = new Dictionary<string, string>();
    public IReadOnlyList<string> Nasals { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Spirantize { get; init; } = new Dictionary<string, string>();
    public IReadOnlyList<string> FunctionWords { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public SpanishNumbers Numbers { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Spanish data tables (see spanish.jsonc). */
    public static readonly SpanishManifest MANIFEST =
        LoadManifest.Load<SpanishManifest>("languages/spanish", "spanish.jsonc");
}

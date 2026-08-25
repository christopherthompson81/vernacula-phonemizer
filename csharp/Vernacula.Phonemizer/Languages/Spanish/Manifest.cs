/**
 * Loads the Spanish data manifest (spanish.jsonc) once at module init and exposes it typed.
 * Ported from src/languages/spanish/manifest.ts — see that file for the corpus evidence.
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
    public IReadOnlyList<string> Months { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> DottedAbbrev { get; init; } = new Dictionary<string, string>();
    /** ⚠ Also the source of the clock half-day reading: `a. m.` is ⟨a⟩ + ⟨m⟩ said as letter names. */
    public IReadOnlyDictionary<string, string> LetterNames { get; init; } = new Dictionary<string, string>();
    public SpanishPhonotactics Phonotactics { get; init; } = new();
    /** MASCULINE — the feminine is derived (-o → -a on every element of a compound). */
    public SpanishOrdinals Ordinals { get; init; } = new();
    public SpanishFractions Fractions { get; init; } = new();
    public string FeminineOne { get; init; } = "";
    public SpanishEraMarkers EraMarkers { get; init; } = new();
    public string UnitedStates { get; init; } = "";
    public string NumberSign { get; init; } = "";
    public SignWords SignWords { get; init; } = null!;
    public SpanishSymbols Symbols { get; init; } = new();
}

public sealed class SpanishPhonotactics
{
    public string Vowels { get; init; } = "";
    public IReadOnlyList<string> Onsets { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Codas { get; init; } = Array.Empty<string>();
}

public sealed class SpanishOrdinals
{
    public IReadOnlyList<string> Units { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Teens { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Tens { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Hundreds { get; init; } = Array.Empty<string>();
    public string Thousandth { get; init; } = "";
}

/** ⚠ `NumeratorOne` is the APOCOPATED "un", a different word from `Numbers.Ones[1]`. */
public sealed class SpanishFractions
{
    public IReadOnlyDictionary<string, string> Denominators { get; init; } = new Dictionary<string, string>();
    public string NumeratorOne { get; init; } = "";
}

public sealed class SpanishEraMarkers
{
    public string BeforeChrist { get; init; } = "";
    public string AfterChrist { get; init; } = "";
}

/** The shared symbol tier's data (Spanish.cs). */
public sealed class SpanishSymbols
{
    public IReadOnlyList<string> Percent { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Currency { get; init; } =
        new Dictionary<string, IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Units { get; init; } =
        new Dictionary<string, IReadOnlyList<string>>();
    public ExponentWordsDef ExponentWords { get; init; } = new();
    public BareExponentDef BareExponent { get; init; } = new();
    public IReadOnlyList<string> Magnitudes { get; init; } = Array.Empty<string>();
    public string MagnitudeConnective { get; init; } = "";
}

public static class Manifest
{
    /** The consolidated hand-authored Spanish data tables (see spanish.jsonc). */
    public static readonly SpanishManifest MANIFEST =
        LoadManifest.Load<SpanishManifest>("languages/spanish", "spanish.jsonc");
}

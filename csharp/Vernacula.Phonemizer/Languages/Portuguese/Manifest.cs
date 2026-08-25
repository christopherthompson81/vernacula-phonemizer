/**
 * Loads the European Portuguese data manifest (portuguese.jsonc) once at module init and exposes it typed.
 * Ported from src/languages/portuguese/manifest.ts — see that file for the corpus evidence.
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
    /** ⚠ READ ONLY ON THE BRAZILIAN PATH — see portuguese.jsonc; a sweep against `pt` scores it dead. */
    public IReadOnlyList<string> Months { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> DottedAbbrev { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> LetterNames { get; init; } = new Dictionary<string, string>();
    public PortuguesePhonotactics Phonotactics { get; init; } = new();
    /** MASCULINE. ⚠ No `Teens` row — Portuguese composes them regularly from `Tens[1]` + a unit. */
    public PortugueseOrdinals Ordinals { get; init; } = new();
    /** ⚠ No `NumeratorOne` — Portuguese does not apocopate before the fraction noun, unlike Spanish. */
    public PortugueseFractions Fractions { get; init; } = new();
    public string FeminineOne { get; init; } = "";
    /** Portuguese SPEAKS the clock noun where Spanish elides it — *sete horas e dezenove*. */
    public PortugueseClock Clock { get; init; } = new();
    public PortugueseEraMarkers EraMarkers { get; init; } = new();
    public string NumberSign { get; init; } = "";
    /** Agrees with the count: exactly 1 → `Singular`, 0 and 2+ → `Plural`. */
    public PortugueseDegree Degree { get; init; } = new();
    public string RealWord { get; init; } = "";
    /** Dollar CODES folded to a bare `$` so the tier's declared key becomes reachable. */
    public IReadOnlyList<string> DollarCodes { get; init; } = Array.Empty<string>();
    public SignWords SignWords { get; init; } = null!;
    public PortugueseSymbolTier SymbolTier { get; init; } = new();
}

public sealed class PortuguesePhonotactics
{
    public string Vowels { get; init; } = "";
    public IReadOnlyList<string> Onsets { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Codas { get; init; } = Array.Empty<string>();
}

public sealed class PortugueseOrdinals
{
    public IReadOnlyList<string> Units { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Tens { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Hundreds { get; init; } = Array.Empty<string>();
    public string Thousandth { get; init; } = "";
}

public sealed class PortugueseFractions
{
    public IReadOnlyDictionary<string, string> Denominators { get; init; } = new Dictionary<string, string>();
}

public sealed class PortugueseClock
{
    public string Hour { get; init; } = "";
    public string Hours { get; init; } = "";
    public string Connector { get; init; } = "";
}

public sealed class PortugueseEraMarkers
{
    public string BeforeChrist { get; init; } = "";
    public string AfterChrist { get; init; } = "";
}

public sealed class PortugueseDegree
{
    public string Singular { get; init; } = "";
    public string Plural { get; init; } = "";
    public string Celsius { get; init; } = "";
    public string Fahrenheit { get; init; } = "";
}

/** The shared symbol tier's data (Portuguese.cs). */
public sealed class PortugueseSymbolTier
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
    /** The consolidated hand-authored European Portuguese data tables (see portuguese.jsonc). */
    public static readonly PortugueseManifest MANIFEST =
        LoadManifest.Load<PortugueseManifest>("languages/portuguese", "portuguese.jsonc");
}

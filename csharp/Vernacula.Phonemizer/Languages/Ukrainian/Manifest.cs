/**
 * Loads the Ukrainian data manifest (ukrainian.jsonc) once and exposes it typed. ⚠ THE TS HAS NO SUCH MODULE:
 * it declares the shape inline in ukrainian.ts and re-loads the file in normalize.ts and romanOrdinals.ts,
 * each for the slice it needs; C# loads it once here and the three files read the same object.
 * Ported from src/languages/ukrainian/ukrainian.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Ukrainian;

/** The Western/Slavic base table + the magnitude count forms, feminine 1/2, and the decimal-comma name. */
public sealed class UkrainianNumbers : EastSlavicNumbers
{
    public string DecimalConnector = "";
}

public sealed class UkrainianDef
{
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Iotated { get; init; } = new Dictionary<string, string>();
    public IReadOnlyList<string> Palatalizers { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> VowelLetters { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> PlainVowels { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public UkrainianNumbers Numbers { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    /** LEXICAL: acronyms read letter-by-letter even though the letters could form a readable word. */
    public IReadOnlyList<string> AcronymLetters { get; init; } = Array.Empty<string>();
    /** MASCULINE nominative — the citation form; `RomanOrdinals` is the NEUTER table and is not a duplicate. */
    public UkrainianOrdinals Ordinals { get; init; } = new();
    public UkrainianGenitiveCardinals GenitiveCardinals { get; init; } = new();
    /** NEUTER — the century noun (століття) is neuter. `Context` deliberately omits вік; see the jsonc. */
    public UkrainianRomanOrdinals RomanOrdinals { get; init; } = new();
    public IReadOnlyDictionary<string, string> LetterNames { get; init; } = new Dictionary<string, string>();
    public UkrainianPhonotactics Phonotactics { get; init; } = new();
    /** Preposition → the `Ordinals.Endings` case name it governs, plus the unprepositioned default. */
    public UkrainianClock Clock { get; init; } = new();
    public IReadOnlyList<string> Degree { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> TemperatureScales { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> DottedAbbrev { get; init; } = new Dictionary<string, string>();
    /** ⚠ ORDERED — `до н. е.` must precede `н. е.` or the longer reading is unreachable. */
    public IReadOnlyList<MultiDotAbbrev> MultiDotAbbrev { get; init; } = Array.Empty<MultiDotAbbrev>();
    public string NumberSign { get; init; } = "";
    public string RangeWord { get; init; } = "";
    public SignWords SignWords { get; init; } = null!;
    public UkrainianSymbols Symbols { get; init; } = new();
}

/** One ordinal adjective ending, hard stem and soft (третій), under the case name the clock rule selects by. */
public sealed class OrdinalEnding
{
    public string Case { get; init; } = "";
    public string Hard { get; init; } = "";
    public string Soft { get; init; } = "";
}

public sealed class UkrainianOrdinals
{
    public IReadOnlyList<string> OneToNineteen { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Tens { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Hundreds { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Thousands { get; init; } = Array.Empty<string>();
    /** ⚠ PREFERENCE ORDER, not paradigm order — the first `EndsWith` match wins. */
    public IReadOnlyList<OrdinalEnding> Endings { get; init; } = Array.Empty<OrdinalEnding>();
}

public sealed class UkrainianGenitiveCardinals
{
    public IReadOnlyList<string> OneToNineteen { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Tens { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Hundreds { get; init; } = Array.Empty<string>();
}

public sealed class UkrainianRomanOrdinals
{
    public IReadOnlyList<string> OneToNineteen { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Tens { get; init; } = Array.Empty<string>();
    public string Hundredth { get; init; } = "";
    public IReadOnlyList<string> Context { get; init; } = Array.Empty<string>();
}

public sealed class UkrainianPhonotactics
{
    public string Vowels { get; init; } = "";
    public IReadOnlyList<string> Onsets { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Codas { get; init; } = Array.Empty<string>();
}

public sealed class UkrainianClock
{
    public IReadOnlyDictionary<string, string> PrepositionCase { get; init; } = new Dictionary<string, string>();
    public string DefaultCase { get; init; } = "";
}

public sealed class MultiDotAbbrev
{
    public string Written { get; init; } = "";
    public string Reading { get; init; } = "";
}

/** The shared symbol tier's data (Ukrainian.cs) — see ukrainian.jsonc for why the metre is declared here. */
public sealed class UkrainianSymbols
{
    public IReadOnlyList<string> Percent { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Currency { get; init; } =
        new Dictionary<string, IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Units { get; init; } =
        new Dictionary<string, IReadOnlyList<string>>();
    public string UnitPer { get; init; } = "";
    public IReadOnlyDictionary<string, string> RateDenominators { get; init; } = new Dictionary<string, string>();
    public ExponentWordsDef ExponentWords { get; init; } = new();
    public IReadOnlyList<string> Magnitudes { get; init; } = Array.Empty<string>();
}

public static class Manifest
{
    public static readonly UkrainianDef DEF = LoadManifest.Load<UkrainianDef>("languages/ukrainian", "ukrainian.jsonc");
}

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
}

public static class Manifest
{
    public static readonly UkrainianDef DEF = LoadManifest.Load<UkrainianDef>("languages/ukrainian", "ukrainian.jsonc");
}

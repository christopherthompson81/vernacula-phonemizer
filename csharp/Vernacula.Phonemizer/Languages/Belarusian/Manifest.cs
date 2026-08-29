/**
 * Loads the Belarusian data manifest (belarusian.jsonc) once and exposes it typed. ⚠ THE TS HAS NO SUCH
 * MODULE: it declares the shape inline in belarusian.ts and re-loads the file in normalize.ts and
 * romanOrdinals.ts, each for the slice it needs; C# loads it once here and the three files read the same
 * object. The manifest is thin — the ordinal paradigms, the letter names and the normalizer tables are
 * hardcoded in normalize.ts — so this type is small.
 * Ported from src/languages/belarusian/belarusian.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Belarusian;

/** The Western/Slavic base table + the magnitude count forms, feminine 1/2, and the decimal-comma name. */
public sealed class BelarusianNumbers : Ukrainian.EastSlavicNumbers
{
    public string DecimalConnector = "";
}

public sealed class BelarusianVoicing
{
    public IReadOnlyDictionary<string, string> ToVoiceless { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ToVoiced { get; init; } = new Dictionary<string, string>();
}

public sealed class BelarusianDef
{
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Iotated { get; init; } = new Dictionary<string, string>();
    public IReadOnlyList<string> Palatalizers { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> VowelLetters { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public BelarusianVoicing Voicing { get; init; } = new();
    public BelarusianNumbers Numbers { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly BelarusianDef DEF = LoadManifest.Load<BelarusianDef>("languages/belarusian", "belarusian.jsonc");
}

/**
 * Loads the Mongolian data manifest (mongolian.jsonc): the letter→IPA tables (single vowels, doubled long
 * vowels, diphthongs, consonants), the back-harmony trigger set, letter names, the acronym list, clause
 * punctuation and the cardinal number words.
 * Ported from src/languages/mongolian/manifest.ts — see the jsonc for the sourcing of every table.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Mongolian;

public sealed class MongolianNumbers
{
    public IReadOnlyList<string> Units { get; init; } = [];
    public IReadOnlyList<string> UnitsAttr { get; init; } = [];
    public IReadOnlyList<string> Tens { get; init; } = [];
    public IReadOnlyList<string> TensAttr { get; init; } = [];
    public string Hundred { get; init; } = "";
    public string HundredAttr { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string ThousandAttr { get; init; } = "";
    public string Million { get; init; } = "";
    public string Billion { get; init; } = "";
}

public sealed class MongolianManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];

    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> LongVowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Diphthongs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public string BackVowels { get; init; } = "";

    /** Cyrillic letter → its NAME, for Core/Initialisms.cs. */
    public IReadOnlyDictionary<string, string> LetterNames { get; init; } = new Dictionary<string, string>();

    /** Acronyms read letter-by-letter although their lowercase form is phonotactically legal. */
    public IReadOnlyList<string> AcronymLetters { get; init; } = [];

    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();

    public MongolianNumbers Numbers { get; init; } = new();
}

public static class Manifest
{
    public static readonly MongolianManifest MANIFEST =
        LoadManifest.Load<MongolianManifest>("languages/mongolian", "mongolian.jsonc");
}

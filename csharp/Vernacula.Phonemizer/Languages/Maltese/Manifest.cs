/**
 * Loads the Maltese data manifest (maltese.jsonc) once at module init and exposes it typed. Holds the
 * hand-authored DATA — the grapheme table, the voicing pairs, the clause marks and the numeral words. The
 * ALGORITHM (the ⟨ie għ h⟩ silent-letter rules, vowel collapse, degemination, the voicing pass) lives in
 * Maltese.cs, and the numeral COMPOSITION in Numbers.cs.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Maltese;

public sealed class MalteseMagnitudes
{
    public string Hundred { get; init; } = "";
    public string HundredConstruct { get; init; } = "";
    public string HundredDual { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string ThousandDual { get; init; } = "";
    public string ThousandPlural { get; init; } = "";
    public string Million { get; init; } = "";
    public string MillionPlural { get; init; } = "";
    public string Billion { get; init; } = "";
    public string BillionPlural { get; init; } = "";
}

public sealed class MalteseNumbers
{
    /** 0–9 ABSOLUTE (counting) forms. */
    public IReadOnlyList<string> Units { get; init; } = Array.Empty<string>();
    /** 10 absolute (għaxra). */
    public string Ten { get; init; } = "";
    public IReadOnlyList<string> Teens { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Tens { get; init; } = new Dictionary<string, string>();
    /** 2–10 pre-mija / pre-miljuni (żewġ, tliet, …, għaxar). */
    public IReadOnlyList<string> AttributiveShort { get; init; } = Array.Empty<string>();
    /** 2–10 pre-elf/elef (żewġt, tlitt, …, għaxart). */
    public IReadOnlyList<string> AttributiveLong { get; init; } = Array.Empty<string>();
    public MalteseMagnitudes Magnitudes { get; init; } = new();
    public string Connector { get; init; } = "";
    public string TeenLinker { get; init; } = "";
}

public sealed class MalteseVoicing
{
    public IReadOnlyDictionary<string, string> Devoice { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Voice { get; init; } = new Dictionary<string, string>();
}

public sealed class MalteseDef
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();
    public MalteseVoicing Voicing { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public MalteseNumbers Numbers { get; init; } = new();
}

public static class Manifest
{
    public static readonly MalteseDef DEF = LoadManifest.Load<MalteseDef>("languages/maltese", "maltese.jsonc");
}

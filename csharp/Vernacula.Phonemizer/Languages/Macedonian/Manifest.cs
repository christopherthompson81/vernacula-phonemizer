/**
 * Loads the Macedonian data manifest (macedonian.jsonc) once at module init and exposes it typed. Holds the
 * hand-authored DATA — the letter→phone table, the front-letter set that drives dark-l, the clause marks,
 * the numeral words and the lexical acronym list. The ALGORITHM (dark-l, syllabic ⟨р⟩, the phonotactics,
 * antepenultimate stress) lives in Macedonian.cs.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Macedonian;

public sealed class MacedonianNumbersDef
{
    public IReadOnlyList<string> Units { get; init; } = Array.Empty<string>();
    public string Ten { get; init; } = "";
    public IReadOnlyList<string> Teens { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Tens { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Hundreds { get; init; } = new Dictionary<string, string>();
    public string Thousand { get; init; } = "";
    public string Thousands { get; init; } = "";
    public string Million { get; init; } = "";
    public string Millions { get; init; } = "";
    public string And { get; init; } = "";
}

public sealed class MacedonianDef
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Letters { get; init; } = new Dictionary<string, string>();
    /** ⟨л⟩ is light [l] before these, dark [ɫ] elsewhere. */
    public IReadOnlyList<string> FrontLetters { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    /** LEXICAL: acronyms Macedonian spells out although the letters could be read as a word. */
    public IReadOnlyList<string> AcronymLetters { get; init; } = Array.Empty<string>();
    public MacedonianNumbersDef Numbers { get; init; } = new();
}

public static class Manifest
{
    public static readonly MacedonianDef DEF =
        LoadManifest.Load<MacedonianDef>("languages/macedonian", "macedonian.jsonc");

    public static readonly IReadOnlySet<string> FRONT_L =
        new HashSet<string>(DEF.FrontLetters, StringComparer.Ordinal);
}

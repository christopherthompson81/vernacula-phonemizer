/**
 * Loads the Lithuanian data manifest (lithuanian.jsonc) once at module init and exposes it typed. Holds the
 * hand-authored DATA — vowel/consonant maps, digraphs, the front/back-vowel sets that drive palatalization
 * and the softening ⟨i⟩, and the voicing-assimilation pairs. The ALGORITHM (palatalization spread, voicing,
 * ŋ-assimilation) lives in G2p.cs (the Czech pattern).
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Lithuanian;

/** A Lithuanian counted noun's three concord forms: nom sg (…1), nom pl (…2–9), gen pl (…0 / …11–19). */
public sealed record LithuanianAgreement
{
    public string Sg { get; init; } = "";
    public string Pl { get; init; } = "";
    public string Gen { get; init; } = "";
    /** The noun is FEMININE, so the numeral's 1–9 component takes the feminine form (*keturios valandos*,
     *  never *keturi valandos*). Only `normalization.countedNouns` sets this; the magnitude nouns are all
     *  masculine. See `Numbers.UnitsFem`. */
    public bool? Fem { get; init; }
}

public sealed record LithuanianVoicing
{
    public IReadOnlyDictionary<string, string> ToVoiceless { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ToVoiced { get; init; } = new Dictionary<string, string>();
}

public sealed record LithuanianMagnitudes
{
    public LithuanianAgreement Hundred { get; init; } = new();
    public LithuanianAgreement Thousand { get; init; } = new();
    public LithuanianAgreement Million { get; init; } = new();
    public LithuanianAgreement Billion { get; init; } = new();
}

public sealed record LithuanianNumbers
{
    public IReadOnlyList<string> Units { get; init; } = Array.Empty<string>();
    /** The FEMININE 1–9. See `LithuanianAgreement.Fem`. */
    public IReadOnlyList<string> UnitsFem { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Teens { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Tens { get; init; } = Array.Empty<string>();
    public LithuanianMagnitudes Magnitudes { get; init; } = new();
}

/** Text-normalization data (Normalize.cs). Every entry's source and sense is recorded in lithuanian.jsonc. */
public sealed record LithuanianNormalization
{
    /** Counted nouns, in the same three-way concord as `Numbers.Magnitudes` — see `Numbers.Agree`. */
    public IReadOnlyDictionary<string, LithuanianAgreement> CountedNouns { get; init; } =
        new Dictionary<string, LithuanianAgreement>();
    /** Invariant words the rules insert (decimal point, signs, range correlative, date vocabulary). */
    public IReadOnlyDictionary<string, string> Words { get; init; } = new Dictionary<string, string>();
    /** Month names in the GENITIVE — the discriminator between a full date and a bare year. */
    public IReadOnlyList<string> MonthsGen { get; init; } = Array.Empty<string>();
    /** Lowercase letter → its Lithuanian NAME, for Core/Initialisms.cs. */
    public IReadOnlyDictionary<string, string> LetterNames { get; init; } = new Dictionary<string, string>();
    /** Lowercase acronyms spelled out although pronounceable — a lexical fact (Core/Initialisms.cs). */
    public IReadOnlyList<string> AcronymLetters { get; init; } = Array.Empty<string>();
}

public sealed record LithuanianManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> VowelDigraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ConsonantDigraphs { get; init; } = new Dictionary<string, string>();
    public string FrontVowels { get; init; } = "";
    public string BackVowels { get; init; } = "";
    public LithuanianVoicing Voicing { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public LithuanianNumbers Numbers { get; init; } = new();
    public LithuanianNormalization Normalization { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Lithuanian data tables (see lithuanian.jsonc). */
    public static readonly LithuanianManifest MANIFEST =
        LoadManifest.Load<LithuanianManifest>("languages/lithuanian", "lithuanian.jsonc");
}

/**
 * Loads the Korean data manifest (korean.jsonc) once at module init and exposes it typed.
 * Ported from src/languages/korean/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Korean;

public sealed class JamoInventory
{
    public string Onset { get; init; } = "";
    public string Vowel { get; init; } = "";
    public string Coda { get; init; } = "";
}

/** A coda jamo's cluster resolution: the consonant kept before a consonant/pause, plus the pair
 *  (lc = what stays behind, lo = what moves to the next onset) used by liaison. */
public sealed class CodaInfo
{
    public string Cons { get; init; } = "";
    public string Lc { get; init; } = "";
    public string Lo { get; init; } = "";
}

public sealed class AspirationTables
{
    public IReadOnlyDictionary<string, string> HCodaLenisOnset { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> StopCodaHOnset { get; init; } = new Dictionary<string, string>();
}

public sealed class KoreanNativeNumbers
{
    public string[] Ones { get; init; } = [];
    public string[] Tens { get; init; } = [];
    public string Twenty { get; init; } = "";
}

public sealed class KoreanNumbersDef
{
    public string[] Ones { get; init; } = [];
    public string Ten { get; init; } = "";
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string[] MyriadUnits { get; init; } = [];
    /** The native series in prenominal form, for normalize.ts's counter rule (see korean.jsonc). */
    public KoreanNativeNumbers Native { get; init; } = new();
}

public sealed class KoreanManifest
{
    public JamoInventory Jamo { get; init; } = new();
    public IReadOnlyDictionary<string, string> Onset { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Vowel { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, CodaInfo> Coda { get; init; } = new Dictionary<string, CodaInfo>();
    public IReadOnlyDictionary<string, string> CodaPhoneme { get; init; } = new Dictionary<string, string>();
    public string NasalCodas { get; init; } = "";
    public IReadOnlyDictionary<string, string> Neutralize { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ObstruentToNasal { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Voice { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Tense { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> TenseJamo { get; init; } = new Dictionary<string, string>();
    public AspirationTables Aspiration { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public KoreanNumbersDef Numbers { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Korean data tables (see korean.jsonc). */
    public static readonly KoreanManifest MANIFEST = LoadManifest.Load<KoreanManifest>("languages/korean", "korean.jsonc");
}

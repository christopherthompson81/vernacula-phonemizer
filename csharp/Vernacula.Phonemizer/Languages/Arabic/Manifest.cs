/**
 * Loads the consolidated Arabic data manifest (arabic.jsonc) once at module init and exposes it typed.
 * Ported from src/languages/arabic/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Arabic;

public sealed class ArabicMarks
{
    public string Fatha { get; init; } = "";
    public string Kasra { get; init; } = "";
    public string Damma { get; init; } = "";
    public string Sukun { get; init; } = "";
    public string Shadda { get; init; } = "";
    public string Fathatan { get; init; } = "";
    public string Kasratan { get; init; } = "";
    public string Dammatan { get; init; } = "";
    public string DaggerAlif { get; init; } = "";
}

public sealed class ArabicLetters
{
    public string Alif { get; init; } = "";
    public string AlifMaqsura { get; init; } = "";
    public string AlifMadda { get; init; } = "";
    public string TaaMarbuta { get; init; } = "";
    public string Waw { get; init; } = "";
    public string Ya { get; init; } = "";
}

public sealed class ArabicMagnitudes
{
    public string Hundred { get; init; } = "";
    public string HundredDual { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string ThousandDual { get; init; } = "";
    public string ThousandsPlural { get; init; } = "";
    public string Million { get; init; } = "";
    public string MillionDual { get; init; } = "";
    public string MillionsPlural { get; init; } = "";
}

public sealed class ArabicNumberData
{
    public IReadOnlyList<string> Ones { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Teens { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Tens { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string>? HundredsConstruct { get; init; }
    public IReadOnlyList<string>? HundredsFused { get; init; }
    public string Connector { get; init; } = "";
    public ArabicMagnitudes Magnitudes { get; init; } = new();
}

public sealed class DiacritizerDef
{
    public IReadOnlyDictionary<string, string> LabelMarks { get; init; } = new Dictionary<string, string>();
    /** Classical spelling → modern, applied to the SKELETON before `DefectiveSpelling` is consulted. */
    public IReadOnlyDictionary<string, string> ClassicalSpelling { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> DefectiveSpelling { get; init; } = new Dictionary<string, string>();
}

public sealed class ArabicManifest
{
    public ArabicMarks Marks { get; init; } = new();
    public ArabicLetters Letters { get; init; } = new();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyList<string> SunLetters { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Proclitics { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public ArabicNumberData Numbers { get; init; } = new();
    public DiacritizerDef Diacritizer { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Arabic data tables (see arabic.jsonc). */
    public static readonly ArabicManifest MANIFEST =
        LoadManifest.Load<ArabicManifest>("languages/arabic", "arabic.jsonc");
}

/**
 * Loads the Mandarin data manifest (cmn.jsonc) once at module init and exposes it typed.
 * Ported from src/languages/mandarin/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Mandarin;

public sealed class ThirdThirdRule
{
    public string From { get; set; } = "";
    public string Before { get; set; } = "";
    public string To { get; set; } = "";
}

public sealed class SandhiDef
{
    public ThirdThirdRule ThirdThird { get; set; } = new();
}

public sealed class CmnNumbersDef
{
    public IReadOnlyList<string> Digits { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Positions { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> BigUnits { get; init; } = Array.Empty<string>();
    public string Two { get; init; } = "";
    public string DecimalPoint { get; init; } = "";
    public string ZeroDigit { get; init; } = "";
}

public sealed class CmnManifest
{
    public IReadOnlyDictionary<string, string> Tones { get; init; } = new Dictionary<string, string>();
    public SandhiDef Sandhi { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public string MeasureWords { get; init; } = "";
    public CmnNumbersDef Numbers { get; init; } = new();
    /** ⚠ Keyed by UPPERCASE Latin — see the jsonc. Dictionary keys are not touched by the loader's
     *  camelCase PROPERTY policy, which is what mangled English's ARPABET block. */
    public IReadOnlyDictionary<string, string> LetterNames { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    /** The consolidated hand-authored Mandarin data tables (see cmn.jsonc). */
    public static readonly CmnManifest MANIFEST =
        LoadManifest.Load<CmnManifest>("languages/mandarin", "cmn.jsonc");
}

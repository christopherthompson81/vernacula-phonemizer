/**
 * Loads the Mandarin data manifest (cmn.jsonc) once at module init and exposes it typed. Holds the tone system,
 * the third-tone sandhi rule, clause punctuation, the measure-word set, and the number-reading tables. The bulk
 * lexical data stays in sibling .tsv files (syllable-ipa / chars / phrases), loaded separately in mandarin.ts.
 * The ALGORITHMS that read this manifest stay in code (pinyinToIpa.ts / numbers.ts / mandarin.ts): the sandhi
 * scan, the Arabic→Chinese numeral compositor, and the tokenizer.
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
}

public static class Manifest
{
    /** The consolidated hand-authored Mandarin data tables (see cmn.jsonc). */
    public static readonly CmnManifest MANIFEST =
        LoadManifest.Load<CmnManifest>("languages/mandarin", "cmn.jsonc");
}

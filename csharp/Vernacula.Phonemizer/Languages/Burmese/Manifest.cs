/**
 * Loads the Burmese data manifest (burmese.jsonc) once and exposes it typed. The TS declares `BurmeseDef`
 * inline in burmese.ts and loads the `numbers` slice separately in numbers.ts; C# names both here and loads
 * the file once. Hand-authored DATA only — the consonant and vowel-sign tables, the coda classes, the
 * coda×vowel RIME CHART, the tone letters, the voicing/devoicing/palatalisation maps and the numerals. The
 * ALGORITHM (syllabification, tone derivation, segmentation, composition) stays in code.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Burmese;

public sealed class BurmeseNumbersDef
{
    public string Zero { get; init; } = "";
    /** index 1–9 (index 0 unused; zero is its own word) */
    public string[] Units { get; init; } = [];
    /** Place words 10¹…10⁷, each as [plain, creaky] — creaky when a remainder follows. */
    public List<List<string>> Places { get; init; } = new();
    /** တစ် — the multiplier for 1, spoken at ရာ and above but not at ဆယ် */
    public string One { get; init; } = "";
}

public sealed class BurmeseDef
{
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> IndependentVowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> IndependentTone { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> VowelSigns { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> CodaClass { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> RimeChart { get; init; }
        = new Dictionary<string, IReadOnlyDictionary<string, string>>();
    public IReadOnlyDictionary<string, string> Tones { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Voicing { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Voiceless { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Palatal { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public BurmeseNumbersDef Numbers { get; init; } = new();
}

public static class Manifest
{
    public static readonly BurmeseDef DEF = LoadManifest.Load<BurmeseDef>("languages/burmese", "burmese.jsonc");
}

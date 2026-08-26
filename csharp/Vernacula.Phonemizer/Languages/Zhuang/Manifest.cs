/**
 * Loads the Zhuang data manifest (zhuang.jsonc) once and exposes it typed — the onset/consonant/vowel
 * tables, the tone-letter→Chao map, clause punctuation and the number words. DATA only; the scan and the
 * cardinal compositor stay in code.
 * Ported from src/languages/zhuang/manifest.ts — see that file for the sourcing.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Zhuang;

public sealed class ZhuangNumbers
{
    public IReadOnlyList<string> Units { get; init; } = Array.Empty<string>();
    public string Ten { get; init; } = "";
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Myriad { get; init; } = "";
    public string HundredMillion { get; init; } = "";
}

public sealed class ZhuangManifest
{
    public IReadOnlyDictionary<string, string> Onsets { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> VowelDigraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Tones { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public string Minus { get; init; } = "";
    public ZhuangNumbers Numbers { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Zhuang data tables (see zhuang.jsonc). */
    public static readonly ZhuangManifest MANIFEST = LoadManifest.Load<ZhuangManifest>("languages/zhuang", "zhuang.jsonc");

    // ⚠ FILE ORDER IS THE SCAN ORDER. The TS scans with `Object.entries(...)`, i.e. the JSON's own key
    // order, and both tables are written LONGEST KEY FIRST (`ngv` before `ng`, `aeu` before `ie`).
    // Re-sorting either list changes the reading.
    public static readonly IReadOnlyList<KeyValuePair<string, string>> ONSETS_ORDERED = MANIFEST.Onsets.ToList();
    public static readonly IReadOnlyList<KeyValuePair<string, string>> VDIGRAPH_ORDERED = MANIFEST.VowelDigraphs.ToList();
}

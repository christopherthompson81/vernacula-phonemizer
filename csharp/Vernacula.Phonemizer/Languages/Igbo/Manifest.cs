/**
 * Loads the Igbo data manifest (igbo.jsonc) once and exposes it typed. DATA only; the algorithms stay in
 * code. The TS splits the shape in two — `IgboManifest` in manifest.ts and `IgboDef` inline in igbo.ts, both
 * over the SAME file — so C# names the whole of it here and loads it once.
 * Ported from src/languages/igbo/manifest.ts — see that file and igbo.jsonc for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Igbo;

public sealed class IgboNumbersDef
{
    public string Zero { get; init; } = "";
    /** The irregular multiplier-1 form: `otu narị` (100), not `narị otu`. */
    public string One { get; init; } = "";
    /** Multipliers 2..9, used AFTER a magnitude word. Slots 0 and 1 are unused. */
    public string[] Units { get; init; } = [];
    public string Ten { get; init; } = "";
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
    public string Billion { get; init; } = "";
    public string And { get; init; } = "";
    public string DecimalWord { get; init; } = "";
}

public sealed class IgboTonesDef
{
    public string High { get; init; } = "";
    public string Low { get; init; } = "";
    public string Down { get; init; } = "";
}

public sealed class IgboDef
{
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IgboTonesDef Tones { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public IgboNumbersDef Numbers { get; init; } = new();
}

public static class Manifest
{
    public static readonly IgboDef MANIFEST = LoadManifest.Load<IgboDef>("languages/igbo", "igbo.jsonc");
}

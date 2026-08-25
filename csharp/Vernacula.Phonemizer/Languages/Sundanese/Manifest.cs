/**
 * Loads the Sundanese data manifest (sundanese.jsonc) once and exposes it typed. DATA only; the algorithms
 * stay in code. The TS declares `SundaneseDef` inline in sundanese.ts, so C# names the whole shape here.
 * Ported from src/languages/sundanese/sundanese.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Sundanese;

public sealed class SundaneseNumbersDef
{
    public IReadOnlyList<string> Units { get; init; } = Array.Empty<string>();
    public string Belas { get; init; } = "";
    public string Puluh { get; init; } = "";
    public string Ratus { get; init; } = "";
    public string Rebu { get; init; } = "";
    public string Yuta { get; init; } = "";
    public string Seprefix { get; init; } = "";
}

public sealed class SundaneseDef
{
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public string Glottal { get; init; } = "";
    public SundaneseNumbersDef Numbers { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly SundaneseDef DEF =
        LoadManifest.Load<SundaneseDef>("languages/sundanese", "sundanese.jsonc");
}

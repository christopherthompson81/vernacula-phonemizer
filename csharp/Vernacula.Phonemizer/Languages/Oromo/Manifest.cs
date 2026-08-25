/**
 * Loads the Oromo data manifest (oromo.jsonc) once and exposes it typed. DATA only; the algorithms stay in
 * code. The TS declares `OromoDef` inline across oromo.ts and normalize.ts, so C# names the whole shape here.
 * Ported from src/languages/oromo/oromo.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Oromo;

public sealed class OromoDef
{
    public string[] GlottalStopLetters { get; init; } = [];
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public string DecimalWord { get; init; } = "";
    public string[] AcronymLetters { get; init; } = [];
}

public static class Manifest
{
    public static readonly OromoDef DEF = LoadManifest.Load<OromoDef>("languages/oromo", "oromo.jsonc");
}

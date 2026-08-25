/**
 * Loads the Uzbek data manifest (uzbek.jsonc) once and exposes it typed. DATA only; the algorithms stay in
 * code. The TS declares `UzbekDef` inline in uzbek.ts, so C# names the whole shape here.
 * Ported from src/languages/uzbek/uzbek.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Uzbek;

public sealed class UzbekDef
{
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    public string Glottal { get; init; } = "";
    public NumbersDef Numbers { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly UzbekDef DEF = LoadManifest.Load<UzbekDef>("languages/uzbek", "uzbek.jsonc");
}

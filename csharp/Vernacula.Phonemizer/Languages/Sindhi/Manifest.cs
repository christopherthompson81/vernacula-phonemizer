/**
 * Loads the Sindhi data manifest (sindhi.jsonc) once and exposes it typed. DATA only; the algorithms stay
 * in code. The TS declares `SindhiDef` inline in sindhi.ts, so C# names the whole shape here.
 * Ported from src/languages/sindhi/sindhi.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Sindhi;

public sealed class SindhiDef
{
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> AspirateWithHe { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> LongVowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Glides { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Harakat { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();

    /** Indic lakh/crore number words — see the note in sindhi.jsonc on how each form was sourced. */
    public NumbersDef Numbers { get; init; } = new();
}

public static class Manifest
{
    public static readonly SindhiDef DEF = LoadManifest.Load<SindhiDef>("languages/sindhi", "sindhi.jsonc");
}

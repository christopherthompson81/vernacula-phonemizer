/**
 * Loads the Shan data manifest (shan.jsonc) once and exposes it typed. ⚠ The TS declares `ShanDef` and
 * `ShanNumbers` inline in shan.ts; C# names both here.
 * Ported from src/languages/shan/shan.ts — see that file for the corpus evidence.
 */
using System.Text.Json;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Shan;

public sealed class ShanNumbers
{
    public string[] Units { get; init; } = [];
    public string Ten { get; init; } = "";
    public string Twenty { get; init; } = "";
    public string FinalOne { get; init; } = "";
    /** ⚠ A TUPLE ARRAY IN THE TS (`[number, string][]`), so JSON gives array-of-arrays and
     *  System.Text.Json has no tuple binding for it. Projected once into `ShanPhonemizer.MAGNITUDES`. */
    public List<List<JsonElement>> Magnitudes { get; init; } = new();
}

public sealed class ShanDef
{
    public IReadOnlyDictionary<string, string> Onsets { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Codas { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Tones { get; init; } = new Dictionary<string, string>();
    public string UnmarkedTone { get; init; } = "";
    public IReadOnlyDictionary<string, string> Palatal { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> VowelSigns { get; init; } = new Dictionary<string, string>();
    public ShanNumbers Numbers { get; init; } = new();
}

public static class Manifest
{
    public static readonly ShanDef DEF = LoadManifest.Load<ShanDef>("languages/shan", "shan.jsonc");
}

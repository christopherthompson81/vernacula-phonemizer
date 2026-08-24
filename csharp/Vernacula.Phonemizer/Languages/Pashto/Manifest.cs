/**
 * Loads the Pashto data manifest (pashto.jsonc) once and exposes it typed — letters, harakat, marks, the
 * zwarakay, clause punctuation and the numeral words. The algorithm stays in Pashto.cs.
 * Ported from src/languages/pashto/pashto.ts, which declares `PashtoDef` inline — see it for the evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Pashto;

public sealed class PashtoNumbersDef
{
    public string[] Units { get; init; } = [];
    /** 10-19, IRREGULAR FUSED forms — 10 is `Teens[0]`, and there is deliberately no separate `ten` key. */
    public string[] Teens { get; init; } = [];
    public IReadOnlyDictionary<string, string> Tens { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Compound { get; init; } = new Dictionary<string, string>();
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
    public string Billion { get; init; } = "";
    public string And { get; init; } = "";
}

public sealed class PashtoDef
{
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Harakat { get; init; } = new Dictionary<string, string>();
    public string Sukun { get; init; } = "";
    public string Shadda { get; init; } = "";
    public string InherentVowel { get; init; } = "";
    public PashtoNumbersDef Numbers { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly PashtoDef DEF = LoadManifest.Load<PashtoDef>("languages/pashto", "pashto.jsonc");
}

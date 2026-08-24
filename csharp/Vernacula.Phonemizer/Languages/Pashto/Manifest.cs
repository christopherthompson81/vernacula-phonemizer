/**
 * Loads the Pashto data manifest (pashto.jsonc) once and exposes it typed. The TS declares `PashtoDef`
 * inline in pashto.ts; C# names it here. Hand-authored DATA only — the consonant letters, the harakat
 * values, the sukun/shadda marks, the zwarakay (the default short vowel the abjad does not write), clause
 * punctuation and the numeral words. The ALGORITHM — the carrier rules that decide vowel-vs-glide, the
 * zwarakay insertion, medial-schwa deletion and stress — stays in code.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Pashto;

public sealed class PashtoNumbersDef
{
    public string[] Units { get; init; } = [];
    /** 10-19, IRREGULAR FUSED forms — so 10 is `Teens[0]` and there is no separate `ten` key; one that was
     *  there duplicated it and nothing read it (#939). */
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

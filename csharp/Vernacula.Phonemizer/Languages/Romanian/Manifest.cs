/**
 * Loads the Romanian data manifest (romanian.jsonc) once and exposes it typed. The TS declares `RomanianDef`
 * inline in romanian.ts and casts `numbers` to a structural type at its use site; C# names both here. Plain
 * letter→IPA maps, the obstruent set, clause punctuation and the number spellings are DATA — the contextual
 * phonology (c/g softening, the rising diphthongs, the glides, final-i desyllabification) is code, in
 * Romanian.cs.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Romanian;

/** GENDER-MARKED numerals — Romanian marks gender only where the unit figure is 1 or 2. */
public sealed class GenderedDef
{
    public string OneMasculine { get; init; } = "";
    public string OneFeminine { get; init; } = "";
    public string OneFeminineFinal { get; init; } = "";
    public string TwoFeminine { get; init; } = "";
    public string TwelveFeminine { get; init; } = "";
}

public sealed class RomanianNumbersDef
{
    public string[] Units { get; init; } = [];
    public string[] Teens { get; init; } = [];
    public string[] Tens { get; init; } = [];
    public string Hundred { get; init; } = "";
    public string Hundreds { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Thousands { get; init; } = "";
    public string Million { get; init; } = "";
    public string Millions { get; init; } = "";
    public string Billion { get; init; } = "";
    public string Billions { get; init; } = "";
    public string And { get; init; } = "";
    public string Of { get; init; } = "";
    public GenderedDef Gendered { get; init; } = new();
}

public sealed class RomanianDef
{
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyList<string> Obstruents { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public RomanianNumbersDef Numbers { get; init; } = new();
}

public static class Manifest
{
    public static readonly RomanianDef DEF = LoadManifest.Load<RomanianDef>("languages/romanian", "romanian.jsonc");
}

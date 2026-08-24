/**
 * Loads the Lingala data manifest (lingala.jsonc) once and exposes it typed. The TS declares `LingalaDef`
 * inline in lingala.ts; C# names it here. Hand-authored DATA only — the consonant graphemes (prenasalised
 * digraphs included), the seven vowels, clause punctuation and the numeral words with their class-alternating
 * scale nouns. The ALGORITHMS (the greedy longest-match scan, the tone assignment, the cardinal composer)
 * stay in code.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Lingala;

public sealed class LingalaNumbersDef
{
    public string[] Ordinals { get; init; } = [];
    public string Zero { get; init; } = "";
    public string Ten { get; init; } = "";
    public string Tens { get; init; } = "";
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string And { get; init; } = "";
    public string FirstCard { get; init; } = "";
    public string TenThousand { get; init; } = "";
    public string TenThousands { get; init; } = "";
    public string HundredThousand { get; init; } = "";
    public string HundredThousands { get; init; } = "";
    public string Million { get; init; } = "";
    public string Millions { get; init; } = "";
    public string Billion { get; init; } = "";
    public string Billions { get; init; } = "";
}

public sealed class LingalaDef
{
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public LingalaNumbersDef Numbers { get; init; } = new();
}

public static class Manifest
{
    public static readonly LingalaDef DEF = LoadManifest.Load<LingalaDef>("languages/lingala", "lingala.jsonc");
}

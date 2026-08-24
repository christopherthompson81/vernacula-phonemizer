/**
 * Loads the Lingala data manifest (lingala.jsonc) once and exposes it typed. DATA only; the algorithms
 * stay in code. The TS declares `LingalaDef` inline, so C# names the shape here.
 * Ported from src/languages/lingala/lingala.ts — see that file for the corpus evidence.
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

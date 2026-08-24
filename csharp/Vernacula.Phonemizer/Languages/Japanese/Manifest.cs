/**
 * Loads the Japanese data manifest (japanese.jsonc) once at module init and exposes it typed. Holds the
 * hand-authored kana→mora tables, the extended-katakana map, the moraic-ん assimilation classes, the Sino-
 * Japanese number words, clause punctuation, and the pitch-accent affix-strip lists. The ALGORITHMS that read
 * them stay in code (kana.ts / numbers.ts / kanji.ts / pitch.ts / japanese.ts); the bulk lexical data stays in
 * sibling .tsv/.txt files (readings/fallback/adverbs/pitch-accent), which the manifest only documents.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Japanese;

public sealed class NasalAssimilationClass
{
    public string Onsets { get; init; } = "";
    public string Nasal { get; init; } = "";
}

public sealed class JapaneseNumberData
{
    public IReadOnlyList<string> Ones { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Hundreds { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Thousands { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> MyriadUnits { get; init; } = Array.Empty<string>();
    public string Ten { get; init; } = "";
    public string Zero { get; init; } = "";
}

public sealed class PitchStripDef
{
    public string Particles { get; init; } = "";
    public IReadOnlyList<string> Copula { get; init; } = Array.Empty<string>();
    public string CopulaFinalParticles { get; init; } = "";
}

public sealed class JapaneseManifest
{
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Mora { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> YouonOnset { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> SmallY { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Foreign { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> VowelKana { get; init; } = new Dictionary<string, string>();
    public IReadOnlyList<NasalAssimilationClass> NasalAssimilation { get; init; } = Array.Empty<NasalAssimilationClass>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public JapaneseNumberData Numbers { get; init; } = new();
    public PitchStripDef PitchStrip { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Japanese data tables (see japanese.jsonc). */
    public static readonly JapaneseManifest MANIFEST =
        LoadManifest.Load<JapaneseManifest>("languages/japanese", "japanese.jsonc");
}

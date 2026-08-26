/**
 * Loads the Lao data manifest (lao.jsonc) once at module init and exposes it typed.
 * Ported from src/languages/lao/lao.ts's MANIFEST block — see that file for the corpus evidence.
 */
using System.Text.Json;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Lao;

/** One vowel PATTERN (lao.jsonc). `Pre` is the reordered leading vowel, `Signs` the characters that
 *  follow the onset; the number consumed is `Signs`'s code-point length. */
public sealed class VowelPattern
{
    public string? Pre { get; init; }
    public string Signs { get; init; } = "";
    public string Q { get; init; } = "";
    public bool? Long { get; init; }
    public string? Glide { get; init; }
}

/** The tone table's per-class row: a value for the classes that differ plus a `default` for the rest. */
public sealed class ToneRow
{
    public string? High { get; init; }
    public string? Mid { get; init; }
    public string? Low { get; init; }
    public string? Default { get; init; }

    /** `row[cls]` — the TS indexes the row by the class string. */
    public string? For(string cls) => cls switch { "high" => High, "mid" => Mid, _ => Low };
}

public sealed class LaoToneTable
{
    public IReadOnlyDictionary<string, ToneRow> Marks { get; init; } = new Dictionary<string, ToneRow>();
    public ToneRow Live { get; init; } = new();
    public ToneRow DeadLong { get; init; } = new();
    public ToneRow DeadShort { get; init; } = new();
}

public sealed class LaoNumbers
{
    public string[] Units { get; init; } = [];
    public string Ten { get; init; } = "";
    public string Twenty { get; init; } = "";
    public string FinalOne { get; init; } = "";
    /** ⚠ A TUPLE ARRAY IN THE TS (`[number, string][]`), so JSON gives array-of-arrays and
     *  System.Text.Json has no tuple binding for it. Projected once into `LaoPhonemizer.MAGNITUDES`. */
    public List<List<JsonElement>> Magnitudes { get; init; } = new();
}

public sealed class LaoManifest
{
    /** Onset consonant → [IPA, tonal class]. */
    public IReadOnlyDictionary<string, string[]> Onsets { get; init; } = new Dictionary<string, string[]>();
    /** ⚠ ORDERED — the pattern walk is first-match, so file order is the algorithm (see lao.jsonc). */
    public VowelPattern[] VowelPatterns { get; init; } = [];
    public LaoToneTable Tone { get; init; } = new();
    public string[] LeadingVowels { get; init; } = [];
    public string[] HLedSonorants { get; init; } = [];
    public string[] ToneMarks { get; init; } = [];
    public IReadOnlyDictionary<string, string> Codas { get; init; } = new Dictionary<string, string>();
    public string CancellationMark { get; init; } = "";
    public LaoNumbers Numbers { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Lao data tables (see lao.jsonc). */
    public static readonly LaoManifest MANIFEST = LoadManifest.Load<LaoManifest>("languages/lao", "lao.jsonc");
}

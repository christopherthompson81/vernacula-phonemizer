/**
 * Loads the Georgian data manifest (georgian.jsonc) once at module init and exposes it typed. Georgian
 * (Mkhedruli) is an essentially ONE-LETTER-ONE-PHONEME orthography, so the g2p is a greedy longest-match
 * scan (Georgian.cs) over the 33-letter grapheme table + ONE context rule (word-final voiced-stop
 * devoicing, also in Georgian.cs). No digraphs; every table key is a single letter.
 * Ported from src/languages/georgian/manifest.ts.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Georgian;

/** A Georgian numeral with two shapes: `Bare` (group-final) and `Comb` — the final ⟨ი⟩-less form used when
 *  a smaller number FOLLOWS it (ასი → ას ერთი, ათასი → ათას ცხრაას …). */
public sealed class GeorgianNumeralPair
{
    public string Bare { get; init; } = "";
    public string Comb { get; init; } = "";
}

/** The bare/comb pair as PARALLEL ARRAYS, which is how the jsonc writes the scores and the hundreds. */
public sealed class GeorgianFormArrays
{
    public IReadOnlyList<string> Bare { get; init; } = [];
    public IReadOnlyList<string> Comb { get; init; } = [];
}

public sealed class GeorgianMagnitudes
{
    public GeorgianNumeralPair Thousand { get; init; } = new();
    public GeorgianNumeralPair Million { get; init; } = new();
    public GeorgianNumeralPair Billion { get; init; } = new();
}

public sealed class GeorgianNumbersDef
{
    public IReadOnlyList<string> Units { get; init; } = [];
    public IReadOnlyList<string> Teens { get; init; } = [];
    /** Vigesimal score words indexed by the score count 1–4 (20, 40, 60, 80); index 0 is unused padding. */
    public GeorgianFormArrays Scores { get; init; } = new();
    /** Round-hundred words indexed by the hundreds digit 1–9; index 0 is unused padding. */
    public GeorgianFormArrays Hundreds { get; init; } = new();
    public GeorgianMagnitudes Magnitudes { get; init; } = new();
}

public sealed class GeorgianConvention
{
    public string Stops { get; init; } = "";
    public string Affricates { get; init; } = "";
    public string Uvulars { get; init; } = "";
    public string Vowels { get; init; } = "";
    public string OtherC { get; init; } = "";
    public string Stress { get; init; } = "";
    public string FinalDevoicing { get; init; } = "";
}

public sealed class GeorgianManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];
    public string Provenance { get; init; } = "";
    public GeorgianConvention Convention { get; init; } = new();
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public GeorgianNumbersDef Numbers { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Georgian data tables (see georgian.jsonc). */
    public static readonly GeorgianManifest MANIFEST =
        LoadManifest.Load<GeorgianManifest>("languages/georgian", "georgian.jsonc");

    /** Grapheme keys sorted LENGTH DESC (all length 1 for Georgian, but the shared pattern keeps the scan
     *  uniform — JS `Object.keys(...).sort((a, b) => b.length - a.length)`, a stable no-op here). */
    public static readonly IReadOnlyList<string> GRAPHEME_KEYS =
        MANIFEST.Graphemes.Keys.OrderByDescending(k => k.Length).ToList();
}

/**
 * Loads the Luxembourgish data manifest (luxembourgish.jsonc): the digraph/grapheme tables, the
 * voiceless-obstruent set that triggers regressive devoicing, the clause punctuation, and the
 * cardinal number words.
 * Ported from the two `loadManifest` calls luxembourgish.ts and numbers.ts make on the same file —
 * see those files for the corpus evidence.
 *
 * ⚠ ONE LOAD, WHERE THE TS HAS TWO. The TS splits the file into a `LuxDef` and a `LuxNumbersDef`
 * slice only to keep numbers.ts from importing the engine (a cycle). C# has no such cycle, and
 * parsing the same immutable file twice is the same data twice.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Danish;

namespace Vernacula.Phonemizer.Languages.Luxembourgish;

/** The `numbers` block. The magnitude shapes are the shared units-first composer's own types, which
 *  live beside it in Languages/Danish; nothing about either is Danish. */
public sealed class LuxNumbersDef
{
    public string[] Ones { get; init; } = [];
    public string[] Tens { get; init; } = [];
    public string[] CompoundOnes { get; init; } = [];
    public string Connector { get; init; } = "";
    public DanishOneWord Hundred { get; init; } = new();
    public DanishOneWord Thousand { get; init; } = new();
    public DanishOnePlural Million { get; init; } = new();
    public DanishOnePlural Billion { get; init; } = new();
}

public sealed class LuxDef
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];

    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();

    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();

    public IReadOnlyList<string> VoicelessObstruents { get; init; } = [];

    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();

    public LuxNumbersDef Numbers { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Luxembourgish data tables (see luxembourgish.jsonc). */
    public static readonly LuxDef MANIFEST = LoadManifest.Load<LuxDef>("languages/luxembourgish", "luxembourgish.jsonc");

    // TS `Object.keys(DIGRAPHS).sort((a, b) => b.length - a.length)` — longest-first, so ⟨sch⟩ beats
    // ⟨s⟩+⟨ch⟩ and ⟨tsch⟩ beats ⟨tz⟩. JS's Array.prototype.sort is stable and OrderByDescending is too;
    // `Dictionary` preserves insertion order (nothing is removed).
    public static readonly IReadOnlyList<string> ORDER =
        MANIFEST.Digraphs.Keys.OrderByDescending(k => k.Length).ToList();

    /** The set that triggers regressive devoicing. */
    public static readonly IReadOnlySet<string> VOICELESS_OBSTR =
        new HashSet<string>(MANIFEST.VoicelessObstruents, StringComparer.Ordinal);
}

/**
 * Loads the Bavarian data manifest (bavarian.jsonc): the digraph/grapheme tables, clause punctuation, the
 * cardinal number words and the sourced ordinal stems.
 * Ported from src/languages/bavarian/manifest.ts (and the second `loadManifest` call bavarian.ts makes on
 * the same file) — see those files for the corpus evidence.
 *
 * ⚠ ONE LOAD, WHERE THE TS HAS TWO. bavarian.ts, manifest.ts and numbers.ts each call `loadManifest` on
 * bavarian.jsonc; the TS splits them only to keep normalize.ts from importing the engine (a cycle). C# has
 * no such cycle, and parsing the same immutable file three times is the same data three times.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Danish;

namespace Vernacula.Phonemizer.Languages.Bavarian;

/** The `numbers` block. The magnitude shapes are the shared units-first composer's own types, which live
 *  beside it in Languages/Danish; nothing about either is Danish. */
public sealed class BarNumbersDef
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

public sealed class BarDef
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];

    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();

    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public BarNumbersDef Numbers { get; init; } = new();

    /** Ordinal stems, ONLY where sourced — an absent index falls back to the cardinal. */
    public IReadOnlyDictionary<string, string> OrdinalStems { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    /** The consolidated hand-authored Bavarian data tables (see bavarian.jsonc). */
    public static readonly BarDef MANIFEST = LoadManifest.Load<BarDef>("languages/bavarian", "bavarian.jsonc");
}

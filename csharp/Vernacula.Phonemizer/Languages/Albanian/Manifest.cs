/**
 * Loads the Albanian data manifest (albanian.jsonc) once at module init and exposes it typed: the
 * digraph and single-grapheme tables, the sonority-class lists the stress rule reads, the cardinal
 * numeral words and the clause punctuation. The composition and the g2p+stress algorithm stay in code.
 * Ported from src/languages/albanian/albanian.ts, which reads the same jsonc directly.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Albanian;

public sealed class AlbanianMagnitudes
{
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
    public string MillionPlural { get; init; } = "";
    public string Billion { get; init; } = "";
    public string BillionPlural { get; init; } = "";
}

/** The cardinal numeral table (albanian.jsonc `numbers`). ⟨tre⟩ is the masculine citation form; see the
 *  jsonc and Numbers.cs for the composition rules and the ⟨e⟩ connector. */
public sealed class AlbanianNumbersDef
{
    /** 0–9 → the plain Albanian numeral (zero…nëntë). */
    public IReadOnlyList<string> Units { get; init; } = [];
    /** 10–19 → unit + ⟨mbë⟩ + dhjetë ("on ten"). */
    public IReadOnlyList<string> Teens { get; init; } = [];
    /** Round tens, keyed by VALUE ("20"…"90"). */
    public IReadOnlyDictionary<string, string> Tens { get; init; } = new Dictionary<string, string>();
    /** 0–9 → the fused round hundreds (index 0 unused). */
    public IReadOnlyList<string> Hundreds { get; init; } = [];
    public AlbanianMagnitudes Magnitudes { get; init; } = new();
    /** ⟨e⟩ — the obligatory "and" connector between the groups of a composed numeral. */
    public string Connector { get; init; } = "";
}

public sealed class AlbanianManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];
    /** Two-letter digraphs → IPA. Scanned longest-first before the single graphemes. */
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    /** Single graphemes → IPA. */
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();
    /** The sonority class 3 (the stress rule's nasal-initial onsets, mp/nd/mpr). */
    public IReadOnlyList<string> Nasals { get; init; } = [];
    /** Sibilants (st/sht/str onsets) — the stress rule's sibilant-initial exceptions. */
    public IReadOnlyList<string> Sibilants { get; init; } = [];
    public AlbanianNumbersDef Numbers { get; init; } = new();
    /** Clause mark → the pause it renders. */
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    /** The hand-authored Albanian data tables (see albanian.jsonc). */
    public static readonly AlbanianManifest MANIFEST =
        LoadManifest.Load<AlbanianManifest>("languages/albanian", "albanian.jsonc");

    /** The digraph keys sorted LENGTH DESC (JS `Object.keys(DIGRAPHS).sort((a, b) => b.length - a.length)`),
     *  so the longest-match scan tries the two-letter keys before the single graphemes. */
    public static readonly IReadOnlyList<string> DIGRAPH_KEYS =
        MANIFEST.Digraphs.Keys.OrderByDescending(k => k.Length).ToList();
}

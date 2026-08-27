/**
 * Loads the Setswana data manifest (setswana.jsonc): the orthography→IPA grapheme table, clause punctuation
 * and the cardinal number words. The ALGORITHM (the greedy longest-match scan) stays in code.
 * Ported from src/languages/setswana/manifest.ts — see the jsonc for the sourcing of every table.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Setswana;

public sealed class SetswanaNumbers
{
    public string Zero { get; init; } = "";
    /** 1..9 (bo- counting series); index 0 unused. */
    public IReadOnlyList<string> Units { get; init; } = [];
    public string Ten { get; init; } = "";
    /** masome */
    public string TensWord { get; init; } = "";
    /** 2..9 tens/hundreds multiplier (ma- / participial -ang). */
    public IReadOnlyList<string> Mult { get; init; } = [];
    public string Hundred { get; init; } = "";
    /** makgolo */
    public string HundredsWord { get; init; } = "";
    public string Thousand { get; init; } = "";
    /** dikete */
    public string ThousandsWord { get; init; } = "";
    /** 2..9 thousands multiplier (tse- / di- series). */
    public IReadOnlyList<string> DiMult { get; init; } = [];
    /** le */
    public string And { get; init; } = "";
    /** a */
    public string Of { get; init; } = "";
    /** tse */
    public string These { get; init; } = "";
}

public sealed class SetswanaManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public SetswanaNumbers Numbers { get; init; } = new();
}

public static class Manifest
{
    public static readonly SetswanaManifest MANIFEST =
        LoadManifest.Load<SetswanaManifest>("languages/setswana", "setswana.jsonc");

    /** Grapheme keys sorted LENGTH DESC so the greedy scan tries trigraphs (tšh, tsh, tlh) before digraphs
     *  before singles. ⚠ JS `Object.keys(...).sort((a, b) => b.length - a.length)` — a Dictionary keeps
     *  insertion order and `OrderByDescending` is stable, so equal-length keys keep the manifest's order. */
    public static readonly IReadOnlyList<string> GRAPHEME_KEYS =
        MANIFEST.Graphemes.Keys.OrderByDescending(k => k.Length).ToList();
}

/**
 * Loads the Aragonese data manifest (aragonese.jsonc) once at module init and exposes it typed: the
 * digraph and single-grapheme tables, the letter environments the code rules test for, the cardinal
 * numeral words and the clause punctuation. The scan, the composition and the symbol tier stay in code.
 * Ported from src/languages/aragonese/aragonese.ts, which reads the same jsonc directly.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Aragonese;

public sealed class AragoneseScale
{
    public double Value { get; init; }
    public string One { get; init; } = "";
    public string Many { get; init; } = "";
}

/** The cardinal numeral table (aragonese.jsonc `numbers`). The composition rules and the ⟨y⟩ connector
 *  live in Numbers.cs; see the jsonc for the sourcing. */
public sealed class AragoneseNumbersDef
{
    /** 0–9 → the plain Aragonese numeral (zero…nueu); 10–19 follow in the same list. */
    public IReadOnlyList<string> Ones { get; init; } = [];
    /** Round tens, indexed by value (20=vinte … 90=novanta); entries 0–1 unused. */
    public IReadOnlyList<string> Tens { get; init; } = [];
    /** 21–29 → the FUSED single words (vintiun … vintinueu); entry 0 unused. */
    public IReadOnlyList<string> Twenties { get; init; } = [];
    /** 100–900 → the hundreds (cient … noucientos); entry 0 unused. */
    public IReadOnlyList<string> Hundreds { get; init; } = [];
    public string Thousand { get; init; } = "";
    /** ⟨y⟩ — the connector between tens and units from 30 up (trenta y un). */
    public string And { get; init; } = "";
    public IReadOnlyList<AragoneseScale> Scales { get; init; } = [];
}

public sealed class AragoneseManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];
    /** Two-letter digraphs → IPA. Scanned longest-first before the single graphemes. */
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    /** Single graphemes → canonical IPA (base values; the c/g softening, the qu/gu clusters, the glides and
     *  the final-r drop are in code). */
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();
    /** The vowel letters — the environment the qu/gu and glide rules test for. */
    public IReadOnlyList<string> VowelLetters { get; init; } = [];
    /** The front vowel letters — the softening environment for ⟨c⟩/⟨g⟩. */
    public IReadOnlyList<string> FrontLetters { get; init; } = [];
    public AragoneseNumbersDef Numbers { get; init; } = new();
    /** Clause mark → the pause it renders. */
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    /** The hand-authored Aragonese data tables (see aragonese.jsonc). */
    public static readonly AragoneseManifest MANIFEST =
        LoadManifest.Load<AragoneseManifest>("languages/aragonese", "aragonese.jsonc");

    /** The digraph keys sorted LENGTH DESC (JS `Object.keys(DIGRAPHS).sort((a, b) => b.length - a.length)`),
     *  so the longest-match scan tries the digraphs before the single graphemes. */
    public static readonly IReadOnlyList<string> DIGRAPH_KEYS =
        MANIFEST.Digraphs.Keys.OrderByDescending(k => k.Length).ToList();
}

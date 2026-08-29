/**
 * Loads the Basque data manifest (basque.jsonc) once at module init and exposes it typed: the digraph
 * pair array (the three-way sibilant hallmark lives there), the single-letter table, the five vowel
 * letters (the environment for the ⟨r⟩ tap/trill split), and the VIGESIMAL numeral words. The scan, the
 * two context rules and the base-20 composition stay in code, in Basque.cs.
 * Ported from src/languages/basque/basque.ts, which reads the same jsonc directly.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Basque;

/**
 * The Basque VIGESIMAL (base-20) number words. 0–19 are listed; the tens are built on scores of 20 —
 * hogei, berrogei (2×20), hirurogei (3×20), laurogei (4×20) — with the connective ⟨-ta⟩ SUFFIXED for a
 * remainder (hogeita hamar = 20+10 = 30). Hundreds prefix the score system and take the FREE connective
 * ⟨eta⟩, as do ⟨mila⟩ and ⟨milioi⟩. See the jsonc for the sourcing.
 */
public sealed class BasqueNumbersDef
{
    /** 0–19, listed. */
    public IReadOnlyList<string> Ones { get; init; } = [];
    /** Multiples of 20 — index 0 unused. */
    public IReadOnlyList<string> Scores { get; init; } = [];
    /** 100–900 — index 0 unused. */
    public IReadOnlyList<string> Hundreds { get; init; } = [];
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
    /** ⟨eta⟩ — the FREE connective, placed once before the final sub-100 group. */
    public string And { get; init; } = "";
}

public sealed class BasqueManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];

    /** The jsonc writes the table as an array of [grapheme, ipa] pairs, longest-first (the TS types it
     *  `[string, string][]`); System.Text.Json binds that shape natively. */
    public IReadOnlyList<string[]> Digraphs { get; init; } = [];

    /** The five vowel letters — Basque has no accented or extra vowels. The environment for the one
     *  context rule: a single ⟨r⟩ is the TAP [ɾ] only BETWEEN two of these. */
    public IReadOnlyList<string> VowelLetters { get; init; } = [];

    /** Single letters → IPA. ⟨h⟩ and ⟨r⟩ are handled in the scan. */
    public IReadOnlyDictionary<string, string> Letters { get; init; } = new Dictionary<string, string>();

    public BasqueNumbersDef Numbers { get; init; } = new();
}

public static class Manifest
{
    /** The hand-authored Basque data tables (see basque.jsonc). */
    public static readonly BasqueManifest MANIFEST =
        LoadManifest.Load<BasqueManifest>("languages/basque", "basque.jsonc");

    /** The digraph table as a lookup keyed by the full grapheme. Every key in the jsonc is exactly two
     *  letters, and the TS scan tests `chars[i] === k[0] && chars[i+1] === k[1]` — for two-letter keys
     *  that is whole-key equality, which is what the lookup does. */
    public static readonly IReadOnlyDictionary<string, string> DIGRAPHS =
        MANIFEST.Digraphs.ToDictionary(p => p[0], p => p[1], StringComparer.Ordinal);

    public static readonly IReadOnlySet<string> VOWELS =
        new HashSet<string>(MANIFEST.VowelLetters, StringComparer.Ordinal);
}

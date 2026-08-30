/**
 * Loads the Irish data manifest (irish.jsonc) once and exposes it typed. The hand-authored DATA
 * (broad/slender consonant maps, lenition digraphs, vowel-cluster lookup, slender/broad vowel sets, clause
 * punctuation, number words) lives in the JSONC; the ALGORITHMS (G2p.cs, Irish.cs, Numbers.cs) read it.
 *
 * Ported from src/languages/irish/manifest.ts.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Irish;

public sealed record IrishMagnitudes
{
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
    public string Billion { get; init; } = "";
}

public sealed record IrishNumbers
{
    /** Counting series: náid, aon, dó, trí, ceathair, … (standalone, and after the particle `a`). */
    public IReadOnlyList<string> Ones { get; init; } = Array.Empty<string>();
    /** Attributive series: —, aon, dhá, trí, ceithre, … (before a counted noun, incl. the magnitudes). */
    public IReadOnlyList<string> Attributive { get; init; } = Array.Empty<string>();
    /** Round tens, keyed by the DECIMAL figure as a string ("20" → fiche) — the decimal series, not the
     *  traditional vigesimal one. */
    public IReadOnlyDictionary<string, string> Tens { get; init; } = new Dictionary<string, string>();
    public string TeenWord { get; init; } = "";
    public IrishMagnitudes Magnitudes { get; init; } = new();
}

public sealed record IrishDef
{
    public string SlenderVowels { get; init; } = "";
    public string BroadVowels { get; init; } = "";
    /** The four broad/slender liquids that svarabhakti breaks. */
    public IReadOnlyList<string> Liquids { get; init; } = Array.Empty<string>();
    /** The consonants after which that break happens. */
    public IReadOnlyList<string> SvarabhaktiNext { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Broad { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Slender { get; init; } = new Dictionary<string, string>();
    /** Lenited digraphs (séimhiú), `[broad, slender]`. "" = silent. */
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Lenition { get; init; } =
        new Dictionary<string, IReadOnlyList<string>>();
    /**
     * Vowel-cluster → IPA. ⚠ THE INSERTION ORDER IS LOAD-BEARING: G2p sorts these keys longest-first with a
     * STABLE sort, exactly as the TS's `Object.keys(...).sort((a, b) => b.length - a.length)` does, so two
     * keys of equal length keep the order the JSONC writes them in.
     */
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public IrishNumbers Numbers { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Irish data tables (see irish.jsonc). */
    public static readonly IrishDef MANIFEST = LoadManifest.Load<IrishDef>("languages/irish", "irish.jsonc");
}

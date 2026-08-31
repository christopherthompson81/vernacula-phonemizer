/**
 * Loads the Scottish Gaelic data manifest (scottishgaelic.jsonc) once and exposes it typed. The
 * hand-authored DATA (broad/slender consonant maps, lenition digraphs, vowel-cluster lookup, the
 * slender/broad vowel sets, the pre-aspiration-licensing sonorants, clause punctuation, number words)
 * lives in the JSONC; the ALGORITHMS (ScottishGaelic.cs, Numbers.cs, Normalize.cs) read it.
 *
 * Ported from src/languages/scottishgaelic/scottishgaelic.ts's `GaelicManifest` — see scottishgaelic.jsonc
 * for the single-source note.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.ScottishGaelic;

public sealed record ScottishGaelicMagnitudes
{
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
    public string Billion { get; init; } = "";
}

public sealed record ScottishGaelicNumbers
{
    /** Counting series 0–10 (standalone, and after the particle `a`). */
    public IReadOnlyList<string> Ones { get; init; } = Array.Empty<string>();
    /** Attributive series (index 0 unused) 1–10 — before a counted noun, including the magnitudes. */
    public IReadOnlyList<string> Attributive { get; init; } = Array.Empty<string>();
    /** Round tens, keyed by VALUE ("20".."90") — the MODERN DECIMAL series, not the vigesimal one. */
    public IReadOnlyDictionary<string, string> Tens { get; init; } = new Dictionary<string, string>();
    public string TeenWord { get; init; } = "";
    public string Connector { get; init; } = "";
    public ScottishGaelicMagnitudes Magnitudes { get; init; } = new();
}

public sealed record ScottishGaelicDef
{
    public string SlenderVowels { get; init; } = "";
    public string BroadVowels { get; init; } = "";
    /** The sonorants (liquids l/r only) that license pre-aspiration — the nasals are deliberately absent. */
    public IReadOnlyList<string> Sonorants { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Broad { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Slender { get; init; } = new Dictionary<string, string>();
    /** Lenited digraphs (séimhichte): [broad, slender]. "" = silent. */
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Lenition { get; init; } =
        new Dictionary<string, IReadOnlyList<string>>();
    /**
     * Vowel-cluster → IPA. ⚠ THE INSERTION ORDER IS LOAD-BEARING: ScottishGaelic.cs sorts these keys
     * longest-first with a STABLE sort, exactly as the TS's `Object.keys(...).sort((a, b) => b.length -
     * a.length)` does, so two keys of equal length keep the order the JSONC writes them in.
     */
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public ScottishGaelicNumbers Numbers { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly ScottishGaelicDef MANIFEST =
        LoadManifest.Load<ScottishGaelicDef>("languages/scottishgaelic", "scottishgaelic.jsonc");
}

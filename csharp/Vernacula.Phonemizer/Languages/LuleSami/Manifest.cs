/**
 * Loads the Lule Sami data manifest (lulesami.jsonc) once at module init and exposes it typed. Holds the
 * grapheme tables and nothing else — the longest-match order, the word-initial ⟨p t k⟩ aspiration rule and
 * the fixed first-syllable stress are ALGORITHM and live in LuleSami.cs.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.LuleSami;

public sealed record LuleSamiDef
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = Array.Empty<string>();
    /**
     * Multi-letter graphemes as [grapheme, phone] pairs, LONGEST-FIRST (trigraphs → digraphs → geminate
     * doubles). ⚠ THE ORDER IS THE DATA: the scan takes the FIRST entry that matches at the cursor, so
     * `ddj` must precede `dj` and `ttj` must precede `tj`. A dictionary would lose that, which is why the
     * manifest spells it as an ordered list of pairs and this mirrors it as one.
     */
    public IReadOnlyList<IReadOnlyList<string>> Multigraphs { get; init; } =
        Array.Empty<IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, string> Letters { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly LuleSamiDef DEF =
        LoadManifest.Load<LuleSamiDef>("languages/lulesami", "lulesami.jsonc");
}

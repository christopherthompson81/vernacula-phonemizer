/**
 * Loads the Kirundi data manifest (kirundi.jsonc) once and exposes it typed — the orthography→IPA grapheme
 * table, clause punctuation and the cardinal word table. The ALGORITHMS (the greedy longest-match scan, the
 * cardinal compositor) stay in code, and the compositor is Kinyarwanda's: rn passes its OWN word table to
 * the shared `ComposeRwandaRundi`.
 * Ported from src/languages/kirundi/manifest.ts — see that file for the rw-vs-rn table deltas.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Kinyarwanda;

namespace Vernacula.Phonemizer.Languages.Kirundi;

public sealed class KirundiManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    /** ⚠ THE SAME TYPE Kinyarwanda DECLARES — rn shares rw's numeral SYSTEM and its compositor; only the
     *  words differ. `Billion` is deliberately absent from rn's table, and that is what sets its ceiling. */
    public RwandaRundiNumbers Numbers { get; init; } = new();
}

public static class Manifest
{
    public static readonly KirundiManifest MANIFEST =
        LoadManifest.Load<KirundiManifest>("languages/kirundi", "kirundi.jsonc");

    // Length DESC so the greedy scan tries the trigraph (shy) before digraphs before singles.
    // ⚠ STABLE, like JS `Array.prototype.sort`: same-length keys keep the manifest's declaration order.
    public static readonly IReadOnlyList<string> GRAPHEME_KEYS =
        MANIFEST.Graphemes.Keys.OrderByDescending(k => k.Length).ToList();
}

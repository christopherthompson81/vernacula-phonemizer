/**
 * Loads the Kinyarwanda data manifest (kinyarwanda.jsonc) once and exposes it typed — the orthography→IPA
 * grapheme table, clause punctuation and the Rwanda-Rundi cardinal word table. The ALGORITHMS (the greedy
 * longest-match scan, the cardinal compositor) stay in code.
 * Ported from src/languages/kinyarwanda/manifest.ts — see that file for the per-magnitude concord evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kinyarwanda;

/** The Rwanda-Rundi cardinal word table — one instance per language (rw / rn), identical shape. */
public sealed class RwandaRundiNumbers
{
    public string[] Units { get; init; } = [];
    public string Ten { get; init; } = "";
    public string[] Tens { get; init; } = [];
    public string Hundred { get; init; } = "";
    public string Hundreds { get; init; } = "";
    public string[] HundredsMul { get; init; } = [];
    public string Thousand { get; init; } = "";
    public string Thousands { get; init; } = "";
    public string[] ThousandsMul { get; init; } = [];
    public string Million { get; init; } = "";
    /** 10⁹ — OPTIONAL: authored for rw (miriyari), deliberately absent for rn. It is what sets the ceiling. */
    public string? Billion { get; init; }
    public string And { get; init; } = "";
}

public sealed class KinyarwandaManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public RwandaRundiNumbers Numbers { get; init; } = new();
}

public static class Manifest
{
    public static readonly KinyarwandaManifest MANIFEST =
        LoadManifest.Load<KinyarwandaManifest>("languages/kinyarwanda", "kinyarwanda.jsonc");

    // Length DESC so the greedy scan tries the trigraph (shy) before digraphs before singles.
    // ⚠ STABLE, like JS `Array.prototype.sort`: same-length keys keep the manifest's declaration order.
    public static readonly IReadOnlyList<string> GRAPHEME_KEYS =
        MANIFEST.Graphemes.Keys.OrderByDescending(k => k.Length).ToList();
}

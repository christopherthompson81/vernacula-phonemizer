/**
 * Loads the Hmong data manifest (hmong.jsonc): the RPA onset (initials) table, the ⟨tx x⟩ palatalization
 * before /i/, the rime table, the final tone letters and their Chao contours, and clause punctuation. The
 * converter ALGORITHM (the syllable parse and the polysyllable split) stays in code.
 * Ported from src/languages/hmong/hmong.ts — see that file and the jsonc for the sourcing.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hmong;

public sealed class HmongManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];
    public IReadOnlyDictionary<string, string> Initials { get; init; } = new Dictionary<string, string>();
    /** ⟨tx x⟩ → [t͡ɕ ɕ] before /i/. */
    public IReadOnlyDictionary<string, string> PalatalBeforeI { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Rimes { get; init; } = new Dictionary<string, string>();
    /** RPA final tone letter → tone number. */
    public IReadOnlyDictionary<string, string> ToneLetter { get; init; } = new Dictionary<string, string>();
    /** Tone number → Chao contour letters. */
    public IReadOnlyDictionary<string, string> ToneChao { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly HmongManifest MANIFEST = LoadManifest.Load<HmongManifest>("languages/hmong", "hmong.jsonc");

    /** Onsets tried longest-first so ⟨ntsh⟩ beats ⟨nts⟩ beats ⟨nt⟩ beats ⟨n⟩, etc. */
    public static readonly IReadOnlyList<string> INITIAL_KEYS =
        MANIFEST.Initials.Keys.OrderByDescending(k => k.Length).ToList();

    /** Rimes tried longest-first so ⟨ee⟩ beats ⟨e⟩, ⟨ai⟩ beats ⟨a⟩, etc. */
    public static readonly IReadOnlyList<string> RIME_KEYS =
        MANIFEST.Rimes.Keys.OrderByDescending(k => k.Length).ToList();

    /** The RPA final tone letters — no coda exists, so a word-final one is the tone, not a consonant. */
    public static readonly HashSet<string> TONE_LETTERS = new(MANIFEST.ToneLetter.Keys, StringComparer.Ordinal);
}

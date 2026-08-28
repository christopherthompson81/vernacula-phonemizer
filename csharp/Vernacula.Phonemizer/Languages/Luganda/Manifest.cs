/**
 * Loads the Luganda data manifest (luganda.jsonc) once and exposes it typed — the orthography→IPA grapheme
 * table, the vowel letters, the prenasalisable obstruents, clause punctuation and the cardinal number words.
 * The gemination + vowel-lengthening ALGORITHM stays in code.
 * Ported from src/languages/luganda/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Luganda;

/** The Luganda cardinal number words. ⚠ EVERY MAGNITUDE CARRIES ITS OWN MULTIPLIER CONCORD SERIES —
 *  amakumi takes a-, bikumi takes bi-, obukadde takes bu- — so one shared units list must never be reused
 *  across multiplier slots. */
public sealed class LugandaNumbers
{
    public string Zero { get; init; } = "";
    /** The citation/counting forms 1–9 at indices 1–9; index 0 unused. */
    public IReadOnlyList<string> Units { get; init; } = Array.Empty<string>();
    public string Ten { get; init; } = "";
    /** The round tens, indices 1–9 (20–50 multiplicative amakumi + a-; 60–90 are single nouns). */
    public IReadOnlyList<string> Tens { get; init; } = Array.Empty<string>();
    public string HundredOne { get; init; } = "";
    public string Hundreds { get; init; } = "";
    public IReadOnlyList<string> HundredsMult { get; init; } = Array.Empty<string>();
    public string ThousandOne { get; init; } = "";
    public string Thousands { get; init; } = "";
    public string MillionOne { get; init; } = "";
    public string Millions { get; init; } = "";
    public string BillionOne { get; init; } = "";
    public string Billions { get; init; } = "";
    /** The class-14 bu- multiplier for obukadde/obuwumbi, indices 2–9. */
    public IReadOnlyList<string> BuMult { get; init; } = Array.Empty<string>();
    public string AndTeen { get; init; } = "";
    public string AndTeenElided { get; init; } = "";
    public string Mu { get; init; } = "";
}

public sealed class LugandaManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();
    /** The five vowel letters — a doubled one is length, not the geminate a doubled consonant makes. */
    public IReadOnlyList<string> VowelLetters { get; init; } = Array.Empty<string>();
    /** The obstruent letters a preceding ⟨n m ŋ⟩ prenasalises into one onset unit. */
    public IReadOnlyList<string> Prenasalisable { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public LugandaNumbers Numbers { get; init; } = new();
}

public static class Manifest
{
    public static readonly LugandaManifest MANIFEST =
        LoadManifest.Load<LugandaManifest>("languages/luganda", "luganda.jsonc");

    // Length DESC so the greedy scan tries nng'/nny/ng'/ny, then the Cw and vowel-length digraphs, before
    // singles. No prenasal digraph is among them — the code rule owns that mapping.
    // ⚠ STABLE, like JS `Array.prototype.sort`: same-length keys keep the manifest's declaration order.
    public static readonly IReadOnlyList<string> GRAPHEME_KEYS =
        MANIFEST.Graphemes.Keys.OrderByDescending(k => k.Length).ToList();
}

/**
 * Loads the Umbundu data manifest (umbundu.jsonc) once at module init and exposes it typed.
 * Ported from src/languages/umbundu/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Umbundu;

/** The Umbundu cardinal number words (see umbundu.jsonc "numbers"; the compositor is numbers.ts). */
public sealed class UmbunduNumbers
{
    /** zero (a Portuguese loan; see the manifest note). */
    public string Zero { get; init; } = "";
    /** the bare citation/counting forms 1–9 at indices 1–9; index 0 unused. */
    public IReadOnlyList<string> Units { get; init; } = Array.Empty<string>();
    /** the additive slot after "la"/"l'", indices 1–9 (irregular: 3 and 5 carry vi-, 2 and 4 do not). */
    public IReadOnlyList<string> Additive { get; init; } = Array.Empty<string>();
    /** ten (ekwi). */
    public string Ten { get; init; } = "";
    /** the cl.6 plural of "ten" (akwi). */
    public string Tens { get; init; } = "";
    /** the cl.6 a- multiplier after `tens`, indices 2–9. */
    public IReadOnlyList<string> TensMult { get; init; } = Array.Empty<string>();
    /** exactly 100 (ocita). */
    public string HundredOne { get; init; } = "";
    /** the cl.8 plural of "hundred" (ovita). */
    public string Hundreds { get; init; } = "";
    /** the cl.8 vi- multiplier after `hundreds`, indices 2–9. */
    public IReadOnlyList<string> HundredsMult { get; init; } = Array.Empty<string>();
    /** "thousand" (ohulukãyi) — used invariant, see the manifest note. */
    public string Thousand { get; init; } = "";
    /** "million" (ohulua); 10⁹ composes as ohulua ohulukãyi. */
    public string Million { get; init; } = "";
    /** the additive connective (la). */
    public string And { get; init; } = "";
    /** the connective elided before a vowel (l'). */
    public string AndElided { get; init; } = "";
}

public sealed class UmbunduManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public UmbunduNumbers Numbers { get; init; } = new();
    /** The shared symbol tier's data — see the jsonc, where the evidence lives. */
    public UmbunduSymbolTier SymbolTier { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Umbundu data tables (see umbundu.jsonc). */
    public static readonly UmbunduManifest MANIFEST =
        LoadManifest.Load<UmbunduManifest>("languages/umbundu", "umbundu.jsonc");

    public static readonly List<string> GRAPHEME_KEYS = MANIFEST.Graphemes.Keys.OrderByDescending(k => k.Length).ToList();
}

public sealed class UmbunduSymbolTier
{
    public IReadOnlyList<string> Percent { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Units { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public string Ampersand { get; init; } = "";
}

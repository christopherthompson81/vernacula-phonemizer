/**
 * Loads the Sepedi data manifest (sepedi.jsonc): the orthography→IPA grapheme table, clause punctuation and
 * the cardinal number words.
 * Ported from the `loadManifest` calls in src/languages/sepedi/{sepedi,numbers,normalize}.ts — see the jsonc
 * for the cited sources and the documented orthographic normalisations.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Sepedi;

/** ⚠ NORTHERN SOTHO'S COMPOUNDS ARE CONJUNCTIVE, which is why there is only ONE stem series plus a single
 *  cl.8 table: `lesome`/`masome`/`makgolo` glue the BARE stem on with no concord prefix, and concord
 *  reappears only at the disjunctive cl.8 magnitudes. ⚠ NOT Sesotho — the stems and the morphology differ. */
public sealed class SepediNumbers
{
    public string Zero { get; init; } = "";
    /** The counting/citation stems 1–9; also the glued multiplier in the conjunctive compounds. */
    public IReadOnlyList<string> Units { get; init; } = [];
    /** cl.8 concord stems, indices 2–9 (after dikete / dimilione / dibilione). */
    public IReadOnlyList<string> Class8 { get; init; } = [];
    public string Ten { get; init; } = "";
    /** The conjunctive teens head — lesome+STEM = 11–19. */
    public string TeenHead { get; init; } = "";
    /** The conjunctive tens head — masome+STEM = 20–90. */
    public string TensHead { get; init; } = "";
    public string HundredOne { get; init; } = "";
    /** The conjunctive hundreds head — makgolo+STEM = 200–900. */
    public string HundredsHead { get; init; } = "";
    public string ThousandOne { get; init; } = "";
    public string Thousands { get; init; } = "";
    public string MillionOne { get; init; } = "";
    public string Millions { get; init; } = "";
    public string BillionOne { get; init; } = "";
    public string Billions { get; init; } = "";
    /** The cl.8 concord particle (tše) between a cl.8 magnitude and its 2–9 multiplier. */
    public string Class8Concord { get; init; } = "";
    /** The conjunction joining magnitude components (le). */
    public string And { get; init; } = "";
}

public sealed class SepediDef
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public SepediNumbers Numbers { get; init; } = new();
}

public static class Manifest
{
    public static readonly SepediDef MANIFEST = LoadManifest.Load<SepediDef>("languages/sepedi", "sepedi.jsonc");

    /** Grapheme keys sorted LENGTH DESC so the greedy scan tries trigraphs before digraphs before singles. */
    public static readonly IReadOnlyList<string> KEYS =
        MANIFEST.Graphemes.Keys.OrderByDescending(k => k.Length).ToList();
}

/**
 * Loads the Sesotho data manifest (sesotho.jsonc): the orthography→IPA grapheme table, clause punctuation
 * and the cardinal number words with their three separate noun-class concord series.
 * Ported from the `loadManifest` calls in src/languages/sesotho/{sesotho,numbers,normalize}.ts — see the
 * jsonc for the cited sources and the South-African-orthography decision.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Sesotho;

/** ⚠ EACH MAGNITUDE SELECTS ITS OWN MULTIPLIER CONCORD SERIES — three tables on purpose. Reusing one
 *  across the multiplier slots is the classic Bantu numeral bug. Sotho 6–9 are RELATIVE verb forms and take
 *  no class prefix, so they look identical in all three: that is correct, not a copy-paste slip. */
public sealed class SesothoNumbers
{
    public string Zero { get; init; } = "";
    /** Bare counting stems 1–9 at indices 1–9. */
    public IReadOnlyList<string> Units { get; init; } = [];
    /** The compound units slot for 1 (motso o le mong). */
    public string UnitOne { get; init; } = "";
    /** The compound units head for 2–9 (metso e), followed by a cl.4 stem. */
    public string UnitNoun { get; init; } = "";
    public IReadOnlyList<string> Class4 { get; init; } = [];
    /** cl.6 concord stems, after mashome / makgolo. */
    public IReadOnlyList<string> Class6 { get; init; } = [];
    /** cl.8 concord stems, after dikete / dimilione / dibilione. */
    public IReadOnlyList<string> Class8 { get; init; } = [];
    public string Ten { get; init; } = "";
    /** "mashome a" — the tens head including its cl.6 concord particle. */
    public string Tens { get; init; } = "";
    public string HundredOne { get; init; } = "";
    /** "makgolo a" — the hundreds head including its cl.6 concord particle. */
    public string Hundreds { get; init; } = "";
    public string ThousandOne { get; init; } = "";
    public string Thousands { get; init; } = "";
    public string MillionOne { get; init; } = "";
    public string Millions { get; init; } = "";
    public string BillionOne { get; init; } = "";
    public string Billions { get; init; } = "";
    /** The cl.8 concord word (tse) between a cl.8 magnitude and its 2–9 multiplier. */
    public string Class8Concord { get; init; } = "";
    /** The conjunction joining magnitude components (le). */
    public string And { get; init; } = "";
}

public sealed class SesothoDef
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public SesothoNumbers Numbers { get; init; } = new();
}

public static class Manifest
{
    public static readonly SesothoDef MANIFEST =
        LoadManifest.Load<SesothoDef>("languages/sesotho", "sesotho.jsonc");

    /** Grapheme keys sorted LENGTH DESC so the greedy scan tries trigraphs before digraphs before singles.
     *  JS `Object.keys(...).sort((a, b) => b.length - a.length)` — a Dictionary keeps insertion order and
     *  `OrderByDescending` is stable, so equal-length keys keep the manifest's own order. */
    public static readonly IReadOnlyList<string> KEYS =
        MANIFEST.Graphemes.Keys.OrderByDescending(k => k.Length).ToList();
}

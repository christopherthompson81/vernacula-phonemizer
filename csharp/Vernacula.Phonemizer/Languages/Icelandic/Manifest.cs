/**
 * Loads the Icelandic data manifest (icelandic.jsonc) once at module init and exposes it typed: the
 * longest-first digraph table (vowel digraphs + the epenthetic-stop / devoiced-sonorant clusters), the
 * single-grapheme table (aspiration folded), the four letter classes the code rules read (the palatalizing
 * front vowels, the one hiatus-glide letter, the long nuclei, the collapsing doubles), clause punctuation,
 * the ordinal series and the cardinal number words.
 * Ported from src/languages/icelandic/icelandic.ts and numbers.ts, which read the same jsonc.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Icelandic;

public sealed class IcelandicManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = [];

    /** Multi-letter graphemes, scanned longest-first. ⟨nn⟩ is context-dependent and handled in code. */
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();

    /** Single grapheme → canonical IPA (⟨p b⟩→p, ⟨t d⟩→t, ⟨k g⟩→k; the ⟨k g⟩→[c] and intervocalic ⟨g⟩
     *  are done in code). */
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();

    /** ⟨k g⟩ → the palatal [c] before one of these. ⟨j⟩ is included: the glide conditions the change
     *  exactly as a front vowel does. */
    public IReadOnlyList<string> FrontVowels { get; init; } = [];

    /** The ONE letter that inserts a glide [j] before a following vowel — the measured answer, not an
     *  oversight (plain ⟨i⟩ and ⟨ý⟩ are not here). */
    public IReadOnlyList<string> HiatusGlideVowels { get; init; } = [];

    /** The accented vowels, long by spelling: a doubled ⟨nn⟩ is the preaspirated [tn] only after one of
     *  these (or after the diphthongs ⟨au ei ey⟩, tested separately in the engine). */
    public IReadOnlyList<string> LongNuclei { get; init; } = [];

    /** The non-stop consonants whose doubling is purely orthographic and collapses to one phone. The
     *  stops are excluded: their doubling is preaspiration, handled separately. */
    public IReadOnlyList<string> CollapsingDoubles { get; init; } = [];

    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();

    public IsNumbers Numbers { get; init; } = new();

    /** Ordinals 1–31, three agreement forms each. See the jsonc for the declension evidence. */
    public IReadOnlyDictionary<string, OrdinalForms> Ordinals { get; init; } =
        new Dictionary<string, OrdinalForms>();
}

/// <summary>One ordinal's weak-declension forms: `Masc` is the masculine nominative (-i), `Common`
/// covers masculine oblique / feminine nominative / all neuter (-a), `FemOblique` the feminine oblique
/// (-u).</summary>
public sealed class OrdinalForms
{
    public string Masc { get; init; } = "";
    public string Common { get; init; } = "";
    public string FemOblique { get; init; } = "";
}

public sealed class IsHundred
{
    public string One { get; init; } = "";
    public string Plural { get; init; } = "";
}

public sealed class IsThousand
{
    public string One { get; init; } = "";
    public string Word { get; init; } = "";
}

public sealed class IsMillion
{
    public string One { get; init; } = "";
    public string Plural { get; init; } = "";
}

public sealed class IsBillion
{
    public string One { get; init; } = "";
    public string Plural { get; init; } = "";
}

public sealed class IsNumbers
{
    public IReadOnlyList<string> Ones { get; init; } = []; // 0–19, the masculine citation series
    public IReadOnlyList<string> OnesFeminine { get; init; } = []; // 1–4; 5+ falls back to `Ones`
    public IReadOnlyList<string> OnesNeuter { get; init; } = []; // 1–4; 5+ falls back to `Ones`
    public IReadOnlyList<string> Tens { get; init; } = []; // index 2–9
    public string Connector { get; init; } = ""; // og
    public IsHundred Hundred { get; init; } = new();
    public IsThousand Thousand { get; init; } = new();
    public IsMillion Million { get; init; } = new();
    public IsBillion Billion { get; init; } = new();
}

public static class Manifest
{
    /** The hand-authored Icelandic data tables (see icelandic.jsonc). */
    public static readonly IcelandicManifest MANIFEST =
        LoadManifest.Load<IcelandicManifest>("languages/icelandic", "icelandic.jsonc");

    // TS `Object.keys(DIGRAPHS).sort((a, b) => b.length - a.length)`: longest first, and the JS sort is
    // STABLE, so equal-length keys keep the manifest's insertion order — `Dictionary` preserves it
    // (nothing is removed).
    public static readonly IReadOnlyList<string> ORDER =
        MANIFEST.Digraphs.Keys.OrderByDescending(k => k.Length).ToList();

    public static readonly IReadOnlySet<string> FRONT_V =
        new HashSet<string>(MANIFEST.FrontVowels, StringComparer.Ordinal);

    public static readonly IReadOnlySet<string> HIATUS_GLIDE =
        new HashSet<string>(MANIFEST.HiatusGlideVowels, StringComparer.Ordinal);

    public static readonly IReadOnlySet<string> LONG_NUCLEUS =
        new HashSet<string>(MANIFEST.LongNuclei, StringComparer.Ordinal);

    public static readonly IReadOnlySet<string> OTHER_DOUBLE =
        new HashSet<string>(MANIFEST.CollapsingDoubles, StringComparer.Ordinal);
}

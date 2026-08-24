/**
 * Loads the Afrikaans data manifest (afrikaans.jsonc) once at module init and exposes it typed.
 * Ported from src/languages/afrikaans/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Afrikaans;

public sealed class AfrikaansNumbersDef
{
    public IReadOnlyList<string> Units { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Teens { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Tens { get; init; } = Array.Empty<string>();
    public string En { get; init; } = "";
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
}

public sealed class AfrikaansMorphologyDef
{
    public IReadOnlyList<string> PrefixUnstressed { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> PrefixStressed { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> AmbiguousPrefixes { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Suffixes { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> VowelInitialSuffixes { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> LinkingElements { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> ValidOnsets { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> StKeep { get; init; } = Array.Empty<string>();
    /** Vowel-initial suffixes that resyllabify the stem's final consonant → it does NOT devoice. */
    public IReadOnlyList<string> ResyllabifyingSuffixes { get; init; } = Array.Empty<string>();
}

public sealed class AfrikaansPhonotactics
{
    public IReadOnlyList<string> LegalOnsets { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> LegalCodas { get; init; } = Array.Empty<string>();
}

public sealed class AfrikaansFractionWords
{
    public string OneHalf { get; init; } = "";
    public string Halves { get; init; } = "";
}

public sealed class AfrikaansManifest
{
    public string Language { get; init; } = "";
    public string Name { get; init; } = "";
    public IReadOnlyList<string> Script { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Fixed { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> VowelsLong { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> VowelsShort { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> DiacriticVowels { get; init; } = new Dictionary<string, string>();
    /** The five bare vowels routed through the open/closed length rule. */
    public IReadOnlyList<string> BareVowels { get; init; } = Array.Empty<string>();
    /** Every letter that heads a nucleus — bounds the consonant run in that same lookahead. */
    public IReadOnlyList<string> VowelLetters { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> VoicedFinal { get; init; } = new Dictionary<string, string>();
    /** The voiceless obstruents of the inventory — the regressive-devoicing trigger, derived over `fixed`. */
    public IReadOnlyList<string> VoicelessPhones { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> UnstressedReduction { get; init; } = new Dictionary<string, string>();
    /**
     * Unstressed but OPEN syllable — the tense quality, taken short. Only the cells that differ from
     * `unstressedReduction`.
     */
    public IReadOnlyDictionary<string, string?> UnstressedOpen { get; init; } = new Dictionary<string, string?>();
    public IReadOnlyList<string> CSoftBefore { get; init; } = Array.Empty<string>();
    /**
     * Morpheme-initial obstruents after which ⟨w⟩ is the glide [w] rather than [v] (swaar, twee, kwaad,
     * dwaal).
     */
    public IReadOnlyList<string> WGlideAfter { get; init; } = Array.Empty<string>();
    /** Derived: word-final suffix → syllables-from-the-END carrying primary stress (0 = final). */
    public IReadOnlyDictionary<string, double> StressFromEnd { get; init; } = new Dictionary<string, double>();
    public IReadOnlyList<string> StressFinalSuffixes { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> StressPenultSuffixes { get; init; } = Array.Empty<string>();
    /** Reduced IPA per unstressed prefix; the keys must equal `morphology.prefixUnstressed`. */
    public IReadOnlyDictionary<string, string> PrefixIpa { get; init; } = new Dictionary<string, string>();
    /** Sign and math words — the shared SHAPE, so an omission is a compile error, not "undefined". */
    public SignWords SignWords { get; init; } = null!;
    /** Clock half-day words, keyed by the written abbreviation. */
    public IReadOnlyDictionary<string, string> ClockPeriods { get; init; } = new Dictionary<string, string>();
    /** Only the halves need words; every other fraction is built on the ordinal. */
    public AfrikaansFractionWords FractionWords { get; init; } = new();
    /** Ordinals 1–19; index 0 unused. Above 20 the ending is regular — see normalize.ts. */
    public IReadOnlyList<string> OrdinalsBelow20 { get; init; } = Array.Empty<string>();
    /** [regex SOURCE, replacement] — every pattern is dot-bound on purpose; see the manifest note. */
    public IReadOnlyList<IReadOnlyList<string>> MultiDotAbbreviations { get; init; } = Array.Empty<IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, string> DottedAbbreviations { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> LetterNames { get; init; } = new Dictionary<string, string>();
    public IReadOnlyList<string> WordAcronyms { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> AcronymLetters { get; init; } = Array.Empty<string>();
    public AfrikaansPhonotactics Phonotactics { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public AfrikaansNumbersDef Numbers { get; init; } = new();
    public AfrikaansMorphologyDef Morphology { get; init; } = new();
}

public static class Manifest
{
    public static readonly AfrikaansManifest MANIFEST =
        LoadManifest.Load<AfrikaansManifest>("languages/afrikaans", "afrikaans.jsonc");

    /**
     * Fixed grapheme keys sorted length-descending so the greedy scan tries trigraphs/digraphs before single
     * letters.
     */
    public static readonly List<string> FIXED_KEYS = MANIFEST.Fixed.Keys.OrderByDescending(k => k.Length).ToList();
}

/**
 * German morphological decomposition — now a thin CONFIG over the shared West-Germanic engine
 * (core/germanicMorphology.ts). The algorithm (prefix/suffix stripping, recursive compound split with the
 * over-split guards) lives in the core; this file supplies German's facts: the affix lists + linking elements +
 * validation onsets from the manifest, the content-stem lexicon (lexicon.tsv, word→flags), and German's specific
 * quirks (un- negation, mit- real-word gate, the ⟨sch⟩ digraph guard, the st/sp/sch element-initial seam, the
 * keep-whole -en verb). Output is byte-identical to the former private module.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.German;

public static class Morphology
{
    public const string BOUNDARY = GermanicMorphology.BOUNDARY;

    // Closed affix lists (this list IS the affix "flag table") — data in german.jsonc, consumed by german.ts too.
    public static IReadOnlyList<string> PREFIX_UNSTRESSED => Manifest.MANIFEST.Morphology.PrefixUnstressed;
    public static IReadOnlyList<string> PREFIX_STRESSED => Manifest.MANIFEST.Morphology.PrefixStressed;
    public static IReadOnlyList<string> SUFFIXES => Manifest.MANIFEST.Morphology.Suffixes;
    public static IReadOnlyDictionary<string, string> PREFIX_IPA => Manifest.MANIFEST.Morphology.PrefixIpa;
    public static IReadOnlyDictionary<string, string> SUFFIX_IPA => Manifest.MANIFEST.Morphology.SuffixIpa;

    // Morphological lexicon: word → flags. k = compound constituent; N = noun; s = takes Fugen-s.
    private static Dictionary<string, string>? LEXICON;
    private static Dictionary<string, string> Lexicon() =>
        LEXICON ??= LoadTsv.LoadTsvMap("languages/german", "lexicon.tsv", optional: true);

    private static string Flags(string w) => Lexicon().GetValueOrDefault(w) ?? "";

    private static IReadOnlyList<string> LINKS_DEFAULT => Manifest.MANIFEST.Morphology.LinkingElements;

    private static readonly MorphologyConfig CONFIG = new()
    {
        Vowels = "aeiouäöüy",
        PrefixUnstressed = Manifest.MANIFEST.Morphology.PrefixUnstressed,
        PrefixStressed = Manifest.MANIFEST.Morphology.PrefixStressed,
        AmbiguousPrefixes = new HashSet<string>(Manifest.MANIFEST.Morphology.AmbiguousPrefixes, StringComparer.Ordinal), // be-/ge-/er- also root-initial → need a real word
        Suffixes = Manifest.MANIFEST.Morphology.Suffixes,
        VowelInitialSuffixes = new HashSet<string>(Manifest.MANIFEST.Morphology.VowelInitialSuffixes, StringComparer.Ordinal),
        ReliableConsSuffixes = new HashSet<string>(new[] { "nis" }, StringComparer.Ordinal), // bünd·nis, ergeb·nis — loose-strip when the stem ends in b/d/g
        LinksFor = head => Flags(head).Contains('s')
            ? new[] { "s" }.Concat(Manifest.MANIFEST.Morphology.LinkingElements).ToList()
            : Manifest.MANIFEST.Morphology.LinkingElements, // promote Fugen-s if flagged
        ValidOnsets = new HashSet<string>(Manifest.MANIFEST.Morphology.ValidOnsets, StringComparer.Ordinal),
        StKeep = new HashSet<string>(Manifest.MANIFEST.Morphology.StKeepWords, StringComparer.Ordinal),
        IsWord = w => Lexicon().ContainsKey(w),
        IsConstituent = w => w.Length >= 3 && Flags(w).Contains('k'),
        NegationPrefix = "un", // un- strips only before another prefix (unge-/unbe-/unver-/unzer-/unent-)
        NegationFollows = JsRegex.Compile("^(ge|be|ver|zer|ent)", ""),
        RealWordStressedPrefixes = new HashSet<string>(new[] { "mit" }, StringComparer.Ordinal), // mit- needs a real-word stem (mit·teilen ✓, not mit·tel)
        SuffixDigraphGuard = (s, stem) => s.StartsWith("ch", StringComparison.Ordinal) && stem.EndsWith("s", StringComparison.Ordinal), // don't split inside ⟨sch⟩ (rausch·en)
        SeamElementInitial = JsRegex.Compile("^(st|sp|sch)", ""), // fest·stellen / klar·stellen reset element-initial (st→ʃt)
        WholeVerbSuffix = "en", // keep a known -en verb whole (schreiben → schreib·en, not schrei·ben)
    };

    /** Decompose a German word into ordered morphemes with a stress hint. */
    public static readonly Func<string, Decomp> Decompose = GermanicMorphology.MakeDecompose(CONFIG);
}

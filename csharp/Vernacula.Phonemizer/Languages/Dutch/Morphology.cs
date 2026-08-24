/**
 * Dutch morphological decomposition — a config over the shared West-Germanic engine (core/germanicMorphology.ts).
 * Dutch compounds like German/Afrikaans (stadhuis, voetbalveld); dutch.ts uses this to find the COMPOUND (stem·stem)
 * boundaries and phonemize each element with its own stress + coda devoicing. The g2p already handles a word's own
 * prefix reduction and suffix schwa, so only stem·stem splits are consumed downstream. The affix lists come from
 * dutch.jsonc; the stem lexicon is a frequency wordlist (nl-stems.txt, hunspell nl.dic base forms). No per-stem
 * Fugen flags → a static linking-element order, and none of German's language-specific quirks apply.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Dutch;

public static class Morphology
{
    private static DutchMorphologyDef M => Manifest.MANIFEST.Morphology;

    // The stem lexicon: a frequency wordlist of Dutch words (one per line). A word ≥3 letters is a valid compound
    // constituent. Optional — absent → no splitting (every word stays whole, the pre-morphology behaviour).
    private static HashSet<string>? STEMS;
    private static readonly object GATE = new();

    private static HashSet<string> Stems()
    {
        lock (GATE)
        {
            if (STEMS is null)
            {
                STEMS = new HashSet<string>(StringComparer.Ordinal);
                try
                {
                    foreach (var line in LoadTsv.LoadLines("languages/dutch", "nl-stems.txt", optional: true))
                    {
                        var w = line.Trim().ToLowerInvariant();
                        if (w.Length > 0) STEMS.Add(w);
                    }
                }
                catch { /* no lexicon → empty, splitter is a no-op */ }
            }
            return STEMS;
        }
    }

    private static IReadOnlyList<string> LINKS => M.LinkingElements;

    private static readonly MorphologyConfig CONFIG = new()
    {
        Vowels = "aeiouyáéíóúàèäëïöü",
        PrefixUnstressed = M.PrefixUnstressed,
        PrefixStressed = M.PrefixStressed,
        AmbiguousPrefixes = new HashSet<string>(M.AmbiguousPrefixes, StringComparer.Ordinal),
        Suffixes = M.Suffixes,
        VowelInitialSuffixes = new HashSet<string>(M.VowelInitialSuffixes, StringComparer.Ordinal),
        ReliableConsSuffixes = new HashSet<string>(StringComparer.Ordinal),
        LinksFor = _ => LINKS, // no per-stem Fugen flags in Dutch → a static order
        ValidOnsets = new HashSet<string>(M.ValidOnsets, StringComparer.Ordinal),
        StKeep = new HashSet<string>(M.StKeep, StringComparer.Ordinal),
        IsWord = w => Stems().Contains(w),
        IsConstituent = w => w.Length >= 3 && Stems().Contains(w),
        // Dutch separable prefixes (aan/af/op/over…) are letters that also begin many roots (aandeel, overheid); with no
        // constituent flags, require the remainder to be a REAL word so they aren't peeled off a monomorpheme.
        RealWordStressedPrefixes = new HashSet<string>(M.PrefixStressed, StringComparer.Ordinal),
        MinTrailingConstituent = 4, // reject 3-letter inflectional-lookalike tails (druk·ken, af·slui·ten, dring·end)
        DontSplitKnownWords = true, // a whole dictionary entry is ONE morpheme — don't tear schakelen → scha·kelen
    };

    /** Is `w` a single known dictionary word? A monomorphemic entry (minister, hamster, spelling) must NOT be compound-
     *  split — with no constituent flags every short lexicon word (ter, ken, ster) would else be a spurious second part. */
    public static bool IsLexicalWord(string w) => Stems().Contains(w);

    /** Decompose a Dutch word into ordered morphemes with a stress hint. */
    public static readonly Func<string, Decomp> Decompose = GermanicMorphology.MakeDecompose(CONFIG);
}

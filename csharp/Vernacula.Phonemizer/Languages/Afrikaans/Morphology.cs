/**
 * Afrikaans morphological decomposition — a config over the shared West-Germanic engine
 * (core/germanicMorphology.ts).
 * Ported from src/languages/afrikaans/morphology.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Afrikaans;

public static class Morphology
{
    private static AfrikaansMorphologyDef M => Manifest.MANIFEST.Morphology;

    private static HashSet<string>? STEMS;

    private static HashSet<string> Stems()
    {
        if (STEMS is null)
        {
            STEMS = new HashSet<string>(StringComparer.Ordinal);
            try
            {
                foreach (var line in LoadTsv.LoadLines("languages/afrikaans", "af-stems.txt", optional: true))
                {
                    var w = line.Trim().ToLowerInvariant();
                    if (w.Length > 0) STEMS.Add(w);
                }
            }
            catch { /* no lexicon → empty, splitter is a no-op */ }
        }
        return STEMS;
    }

    private static IReadOnlyList<string> LINKS => M.LinkingElements;

    private static readonly MorphologyConfig CONFIG = new()
    {
        Vowels = "aeiouyêôûîëïéèáàóúü",
        PrefixUnstressed = M.PrefixUnstressed,
        PrefixStressed = M.PrefixStressed,
        AmbiguousPrefixes = new HashSet<string>(M.AmbiguousPrefixes, StringComparer.Ordinal),
        Suffixes = M.Suffixes,
        VowelInitialSuffixes = new HashSet<string>(M.VowelInitialSuffixes, StringComparer.Ordinal),
        ReliableConsSuffixes = new HashSet<string>(StringComparer.Ordinal),
        LinksFor = head => head.EndsWith("s", StringComparison.Ordinal)
            ? LINKS.Where(l => l != "s").ToList()
            : LINKS,
        ValidOnsets = new HashSet<string>(M.ValidOnsets, StringComparer.Ordinal),
        StKeep = new HashSet<string>(M.StKeep, StringComparer.Ordinal),
        IsWord = w => Stems().Contains(w),
        IsConstituent = w => w.Length >= 3 && Stems().Contains(w),
        RealWordStressedPrefixes = new HashSet<string>(M.PrefixStressed, StringComparer.Ordinal),
    };

    /** Decompose an Afrikaans word into ordered morphemes with a stress hint. */
    public static readonly Func<string, Decomp> Decompose = GermanicMorphology.MakeDecompose(CONFIG);
}

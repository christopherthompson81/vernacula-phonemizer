/**
 * Afrikaans morphological decomposition — a config over the shared West-Germanic engine
 * (core/germanicMorphology.ts). Afrikaans compounds like Dutch/German (aandete, afwesigheid); splitting into
 * morphemes lets afrikaans.ts phonemize each element with its own stress + coda devoicing. The affix lists + linking
 * elements + onsets come from afrikaans.jsonc; the stem lexicon is a wordlist (af-stems.txt, provenance in
 * af-stems.PROVENANCE.md). ⚠ Afrikaans has no per-stem Fugen flags, so the linking-element order is static, and
 * none of German's language-specific quirks (un-/mit-/sch/seams/-en) apply.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Afrikaans;

public static class Morphology
{
    private static AfrikaansMorphologyDef M => Manifest.MANIFEST.Morphology;

    // The stem lexicon: a frequency wordlist of Afrikaans words (one per line). A word ≥3 letters is a valid compound
    // constituent. Optional — absent → no splitting (every word stays whole, the pre-morphology behaviour).
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
        // No per-stem Fugen flags in Afrikaans, so the order is static — EXCEPT that a head already ending in ⟨s⟩
        // may not take the linking ⟨s⟩. Without that, trying ⟨s⟩ first (see the manifest note on why it must be
        // first) re-splits tuis·span as tuiss·pan, pols·slag as polss·lag, tennis·span as tenniss·pan: the head's
        // own final ⟨s⟩ gets read as the Fugen and the next element loses its onset. Measured: −32 without it.
        LinksFor = head => head.EndsWith("s", StringComparison.Ordinal)
            ? LINKS.Where(l => l != "s").ToList()
            : LINKS,
        ValidOnsets = new HashSet<string>(M.ValidOnsets, StringComparer.Ordinal),
        StKeep = new HashSet<string>(M.StKeep, StringComparer.Ordinal),
        IsWord = w => Stems().Contains(w),
        IsConstituent = w => w.Length >= 3 && Stems().Contains(w),
        // Afrikaans separable prefixes (aan/af/op/uit…) are letters that also begin many roots (aand, afdeling); with no
        // constituent flags, require the remainder to be a REAL word before peeling one off.
        // ⚠ THIS GUARD DOES NOT SAVE aandete, which it was once documented as saving: "dete" IS in af-stems.txt (a
        // frequency wordlist carries fragments), so the guard passes and the word is torn to aan·dete — the stressed-
        // prefix strip runs before splitCompound, which would otherwise have found aand·ete. Measured cost: 1 word.
        RealWordStressedPrefixes = new HashSet<string>(M.PrefixStressed, StringComparer.Ordinal),
    };

    /** Decompose an Afrikaans word into ordered morphemes with a stress hint. */
    public static readonly Func<string, Decomp> Decompose = GermanicMorphology.MakeDecompose(CONFIG);
}

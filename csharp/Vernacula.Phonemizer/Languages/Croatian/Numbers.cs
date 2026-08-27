/**
 * Croatian cardinal number → words. Reuses the shared Serbo-Croatian agreement compositor
 * (Serbian.Numbers.ComposeSlavicNumber) with the CROATIAN number-word table.
 * Ported from src/languages/croatian/numbers.ts — see that file for the corpus evidence.
 */
namespace Vernacula.Phonemizer.Languages.Croatian;

public static class Numbers
{
    /**
     * Non-negative integer (< 10⁹) → Croatian words; larger / non-finite → digit-by-digit.
     * ⚠ `raw` IS THE TOKEN STRING AND THE CALLER MUST PASS IT (#1059), and it must be the
     * SEPARATOR-STRIPPED one — see Croatian.cs.
     */
    public static string NumberToWords(double n, string? raw = null) =>
        Serbian.Numbers.ComposeSlavicNumber(n, Manifest.MANIFEST.Numbers, raw);
}

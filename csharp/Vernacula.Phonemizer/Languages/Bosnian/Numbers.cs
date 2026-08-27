/**
 * Bosnian cardinal number → words: the shared Serbo-Croatian agreement compositor with the Bosnian
 * number-word table (Serbian hiljada/milion + the ijekavian dvjesta).
 * Ported from src/languages/bosnian/numbers.ts — see that file for the corpus evidence.
 */
namespace Vernacula.Phonemizer.Languages.Bosnian;

public static class Numbers
{
    /** Non-negative integer (< 10⁹) → Bosnian words; larger / non-finite → digit-by-digit.
     *  ⚠ `raw` IS THE TOKEN STRING AND THE CALLER MUST PASS IT (#1059) — the digits cannot be recovered from
     *  the double. */
    public static string NumberToWords(double n, string? raw = null) =>
        Serbian.Numbers.ComposeSlavicNumber(n, Manifest.MANIFEST.Numbers, raw);
}

/**
 * Kirundi cardinal number → words. The numeral morphology is the same Rwanda-Rundi system as Kinyarwanda's,
 * so the compositor is SHARED (`Kinyarwanda.Numbers.ComposeRwandaRundi`) and only the word table differs.
 * Ported from src/languages/kirundi/numbers.ts — see that file for the rw-vs-rn table deltas and for why
 * `raw` is load-bearing (#1075: re-stringifying the double reads a different quantity above 2⁵³).
 */
using Vernacula.Phonemizer.Languages.Kinyarwanda;

namespace Vernacula.Phonemizer.Languages.Kirundi;

public static class Numbers
{
    /** Non-negative integer (< 10⁹) → Kirundi words; larger / non-finite → digit-by-digit from `raw`. */
    public static string NumberToWords(double n, string? raw = null) =>
        Kinyarwanda.Numbers.ComposeRwandaRundi(n, Manifest.MANIFEST.Numbers, raw);
}

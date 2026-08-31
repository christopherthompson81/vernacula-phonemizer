/**
 * Kikuyu / Gĩkũyũ (ki) cardinal number → words (space-separated; each word then runs through the g2p,
 * so the IPA stays consistent with the word engine). The FORM emitted is the CITATION / COUNTING series
 * (ĩmwe, igĩrĩ, ithatũ …).
 * Ported from src/languages/kikuyu/numbers.ts — see that file and src/languages/kikuyu/e5xNumbers.ts
 * for the corpus evidence behind the class-concord multipliers.
 */
namespace Vernacula.Phonemizer.Languages.Kikuyu;

public static class Numbers
{
    /** A non-negative integer → space-separated Kikuyu cardinal words (10⁹ = mirioni ngiri ĩmwe, "a thousand million").
     *  ⚠ THE WRAPPER MUST NOT DROP `raw` (#1095) — see the TS. */
    public static string NumberToWords(double n, string? raw = null) =>
        E5xNumbers.RenderE5xNumber(n, Manifest.MANIFEST.Numbers, raw);
}

/**
 * Kamba / Kĩkamba (kam) cardinal number → words (space-separated; each word then runs through the g2p,
 * so the IPA stays consistent with the word engine). The FORM emitted is the CITATION / COUNTING series
 * (ĩmwe, ĩlĩ, itatũ …).
 * Ported from src/languages/kamba/numbers.ts — see that file and src/languages/kikuyu/e5xNumbers.ts for
 * the manual's kũtala list and the shared E5x formation.
 */
using Vernacula.Phonemizer.Languages.Kikuyu;

namespace Vernacula.Phonemizer.Languages.Kamba;

public static class Numbers
{
    /** A non-negative integer → space-separated Kamba cardinal words (10⁹ = milioni ngili ĩmwe, "a thousand million").
     *  ⚠ THE WRAPPER MUST NOT DROP `raw` (#1095) — see the TS. */
    public static string NumberToWords(double n, string? raw = null) =>
        E5xNumbers.RenderE5xNumber(n, Manifest.MANIFEST.Numbers, raw);
}

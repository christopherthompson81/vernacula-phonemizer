using System.Text.RegularExpressions;

namespace Vernacula.Phonemizer.Core;

/**
 * THE PIPELINE-STRING SEAM — #1150 stage 2, and the one place normalizer provenance is maintained.
 *
 * `Rewrite(s, RE, rep)` is the C# spelling of the TypeScript's `rewrite(s, re, rep)`, deliberately down to
 * the argument order, so a normalizer reads the same in both engines:
 *
 *     TS   s = rewrite(s, KM2, " square kilometres");
 *     C#   s = Rewrite(s, KM2, " square kilometres");
 *
 * ⚠ IT DECLARES SOMETHING, RATHER THAN SPELLING `Replace` DIFFERENTLY. Calling it asserts that `s` IS the
 * pipeline string — the text the trace's `normalized` will eventually be, and whose offsets map back to the
 * caller's input. A regex replace on anything else (a matched word, a single character, a lookup key built
 * in a static constructor) must stay on `JsRe.Replace`, which no longer touches the mapping at all.
 *
 * ⚠ THAT DISTINCTION IS DYNAMIC, NOT STATIC, so it is measured rather than reasoned about. `s = X.Replace(s, …)`
 * inside a per-word helper is textually identical to the pipeline form; only running the corpus with
 * `Provenance.OnPoison` installed can tell them apart. Adopting the seam in a new language is therefore:
 * convert broadly, run the goldens, revert exactly the sites the poison names.
 *
 * ⚠ AND BECAUSE THE SEAM IS NOW NARROW, THE MISMATCH RULE MATCHES THE TYPESCRIPT'S. While provenance lived
 * inside `JsRe.Replace` the whole codebase was a participant, so a string the mapping did not recognise had
 * to be IGNORED — and that tolerance is exactly what let `Mandarin.SubstituteNumbers` (net length-preserving,
 * outside the seam) and `Initialisms`' static initializer (an 8-character lookup key) report confident wrong
 * spans. Here an unrecognised string can only mean a pipeline step went unseen, so it POISONS, and the two
 * engines finally carry one rule instead of two.
 */
public static class Rewriter
{
    /// <summary>JS `s.replace(re, replacement)` on the PIPELINE STRING, carrying provenance.</summary>
    public static string Rewrite(string s, JsRe re, string replacement) =>
        re.Replace(s, JsRe.Evaluator(replacement), Provenance.StartTrack(s));

    /// <summary>JS `s.replace(re, callback)` on the PIPELINE STRING, carrying provenance.</summary>
    public static string Rewrite(string s, JsRe re, MatchEvaluator evaluator) =>
        re.Replace(s, evaluator, Provenance.StartTrack(s));
}

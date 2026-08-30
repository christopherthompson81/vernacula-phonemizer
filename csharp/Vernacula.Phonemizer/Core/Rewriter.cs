using System.Text;
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

    /// <summary>Is a trace recording? For a pass that must build its provenance explicitly, not through a seam.</summary>
    public static bool Tracing() => Provenance.IsRecording();

    /// <summary>One piece of a rebuilt string: <c>Text</c> came from <c>s[From, To)</c>. A zero-width span is an INSERTION.</summary>
    public readonly record struct Piece(string Text, int From, int To);

    /**
     * A pass that REBUILDS the pipeline string, reporting its own pieces — the seam's third primitive, and
     * the mirror of the TypeScript's `rebuilt`.
     *
     * ⚠ SEGMENTATION IS NEITHER A REPLACE NOR A NORMALIZE, and it was the last thing mapping nothing at all.
     * `km` restores word boundaries by inserting U+200B, `ja` inserts bunsetsu spaces, and `cmn` rewrites the
     * utterance as a code-point list; all three walk the string and build a new one, so `Rewrite` never sees
     * them. `cmn` is the sharpest case: it is NET LENGTH-PRESERVING (`11`→`十一`, `20`→`二十`), so it desynced
     * the mapping without changing its length and without tripping any guard.
     *
     * ⚠ AND THE PIECES MUST TILE THE INPUT, WHICH IS THE WHOLE CHECK. Each piece names the span it consumed;
     * they have to start where the last one ended and finish at the end of the string. A pass that miscounts
     * gets its mapping WITHHELD rather than a plausible-looking one.
     */
    public static string Rebuilt(string s, IReadOnlyList<Piece> pieces)
    {
        var sb = new StringBuilder(s.Length);
        foreach (var piece in pieces) sb.Append(piece.Text);
        var outText = sb.ToString();
        var track = Provenance.StartTrack(s);
        if (track is null) return outText;
        var cursor = 0;
        var count = 0;
        foreach (var piece in pieces)
        {
            if (piece.From != cursor || piece.To < piece.From) { Provenance.PoisonExternally(s, outText); return outText; }
            cursor = piece.To;
            track.Stamp(piece.From, piece.To - piece.From, piece.Text.Length);
            count += piece.Text.Length;
        }
        if (cursor != s.Length || count != outText.Length) { Provenance.PoisonExternally(s, outText); return outText; }
        track.Commit(outText);
        return outText;
    }

    /**
     * A canonical block: a Hangul jamo run, a surrogate pair with its marks, or one code unit with its marks.
     *
     * ⚠ NORMALIZATION DOES NOT REACH ACROSS A STARTER, which is what makes a chunked normalize equal to a
     * whole-string one — but only if the chunking is right, and Hangul is the exception that proves it (L, V
     * and T jamo are all starters and NFC composes them together). The surrogate pair is spelt out because
     * .NET regexes are code-unit based; `csharp/tools/regex-diff` measured the `[\s\S]` form splitting
     * `𠀁 𫝀 😀` into six halves where Node saw three characters.
     */
    private static readonly JsRe CANONICAL_BLOCK = JsRegex.Compile(
        "[\\u1100-\\u11FF\\uA960-\\uA97F\\uD7B0-\\uD7FF]+|[\\uD800-\\uDBFF][\\uDC00-\\uDFFF]\\p{M}*|[\\s\\S]\\p{M}*", "gu");

    /**
     * `s.Normalize(form)` on the PIPELINE STRING, carrying provenance — the seam's second primitive, and the
     * mirror of the TypeScript's `renormalize`.
     *
     * ⚠ A NORMALIZE IS NOT A REPLACE, and it was the largest hole left after the seam itself. Because it is
     * length-CHANGING (`Mìng` precomposed is 4 code units, decomposed is 5) the mapping fell out of step at
     * the FIRST character and every token in the utterance lost its span — with no poison anywhere to say
     * why, because the desync happened before any `Rewrite` ran. Measured in the TypeScript: cdo mapped 6%
     * of its tokens and ee 29%, and both reached 100% once this existed.
     */
    public static string Renormalize(string s, NormalizationForm form)
    {
        // ⚠ `Js.Normalize`, NOT `string.Normalize`. The subject is the PIPELINE STRING — untrusted input —
        // and .NET refuses a string carrying an unpaired surrogate where JS returns it unchanged. This
        // THREW from the shipped `Phonemize()` for every engine whose normalize pass opens with a
        // renormalization: `normalizeKamba("1\ud83d000")` threw where the TypeScript answered
        // `"1\ud83d000"`. #1199's class, in the shared core rather than in one language.
        var whole = Js.Normalize(s, form);
        // ⚠ THE UNTRACED TEST COMES FIRST, and the order is the point. `whole == s` is an O(n) comparison, so
        // putting it ahead would charge every shipped utterance for a check only the traced path can act on.
        // `StartTrack` returns null on the first field read when nothing is recording.
        var track = Provenance.StartTrack(s);
        // ⚠ A NO-OP NEEDS NO MAPPING WORK AT ALL, and it is the common case — the mapping already describes `s`.
        if (track is null || whole == s) return whole;
        var at = 0;
        var rebuilt = new StringBuilder(whole.Length);
        foreach (Match m in CANONICAL_BLOCK.Matches(s))
        {
            var piece = Js.Normalize(m.Value, form); // the pieces are slices of `s`, so equally untrusted
            rebuilt.Append(piece);
            track.Stamp(at, m.Value.Length, piece.Length);
            at += m.Value.Length;
        }
        // ⚠ VERIFIED, NOT ASSUMED. If the blocks do not reassemble into what `Normalize` actually produced,
        // the chunking was wrong for this text and the mapping would be a confident lie.
        if (at != s.Length || rebuilt.ToString() != whole) { Provenance.PoisonExternally(s, whole); return whole; }
        track.Commit(whole);
        return whole;
    }
}

/**
 * Khmer word-boundary AVERAGED PERCEPTRON — the dependency-free (synchronous) boundary restorer, a Map of
 * character-window feature weights and an addition loop.
 * Ported from src/languages/khmer/khmerPerceptron.ts — see that file for the model comparison and the
 * MIN_PIECE decode guard's measured cost.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Khmer;

public static class KhmerPerceptron
{
    /** U+200B ZERO WIDTH SPACE — what Khmer writers type at a word boundary, and what the tokeniser breaks on. */
    public const string ZWSP = "​";

    private static readonly JsRe KHMER_RUN = JsRegex.Compile("[ក-៓ៜ-៝]{2,}", "gu");

    /** The trainer's padding sentinel for positions off the end of the run. */
    private const string PAD = " ";

    private static readonly Dictionary<string, double> W = LoadTsv.LoadTsvMapV<double>(
        "languages/khmer",
        "km-perceptron.tsv",
        (v, _) =>
        {
            var n = Js.Number(v);
            return double.IsFinite(n) ? n : (double?)null;
        },
        optional: true);

    /** Is the perceptron's weight table available? */
    public static bool HavePerceptron() => W.Count > 0;

    private static double Weight(string key) => W.TryGetValue(key, out var w) ? w : 0;

    /** Score one candidate boundary: does a word START at `i`? The feature-string prefixes are a WIRE FORMAT
     *  shared with train_km_perceptron.py's `feats()`. */
    private static double Score(string run, int i)
    {
        string At(int k) => k >= 0 && k < run.Length ? run[k].ToString() : PAD;
        string c2 = At(i - 2), c1 = At(i - 1), c0 = At(i), d1 = At(i + 1), d2 = At(i + 2);
        var s = 0d;
        s += Weight("a" + c2);
        s += Weight("b" + c1);
        s += Weight("c" + c0);
        s += Weight("d" + d1);
        s += Weight("e" + d2);
        s += Weight("f" + c2 + c1);
        s += Weight("g" + c1 + c0);
        s += Weight("h" + c0 + d1);
        s += Weight("i" + d1 + d2);
        s += Weight("j" + c1 + d1);
        s += Weight("k" + c1 + c0 + d1);
        return s;
    }

    private const int MIN_PIECE = 2;
    /** Khmer independent vowels ឣ..ឳ — the one class that IS a standalone one-character word. */
    private static readonly JsRe STANDALONE_1CHAR = JsRegex.Compile("[\\u17A3-\\u17B3]", "u");

    /** Split one maximal Khmer run into words. Returns `[run]` when the weight table is unavailable. */
    public static IReadOnlyList<string> SegmentRun(string run)
    {
        if (W.Count == 0 || run.Length < MIN_PIECE + 1) return new[] { run };
        var @out = new List<string>();
        var start = 0;
        for (var i = 1; i < run.Length; i++)
        {
            if (Score(run, i) <= 0) continue;
            bool ShortOk(int a, int b) =>
                b - a >= MIN_PIECE || (b - a == 1 && STANDALONE_1CHAR.IsMatch(run[a].ToString()));
            if (!ShortOk(start, i) || !ShortOk(i, run.Length)) continue;
            @out.Add(run[start..i]);
            start = i;
        }
        @out.Add(run[start..]);
        return @out;
    }

    /** Insert U+200B at every predicted word boundary inside each Khmer run of `text`. Synchronous, and a
     *  no-op when the weight table is missing. */
    public static string RestoreBoundaries(string text)
    {
        if (W.Count == 0) return text;
        // ⚠ THE SHIPPED PATH IS UNCHANGED — one native replace, exactly as before. The piece list below costs
        // an array per utterance and exists only while a trace is recording.
        if (!Tracing()) return KHMER_RUN.Replace(text, m => string.Join(ZWSP, SegmentRun(m.Value)));
        // ⚠ PER-WORD SPANS, NOT PER-RUN (#1150). This IS a replace, so `Rewrite` would have covered it in one
        // line — and would have stamped a single span across a whole maximal Khmer run, which for this corpus
        // is frequently a sentence. The point of restoring boundaries is to know where the words are.
        var pieces = new List<Piece>();
        var at = 0;
        foreach (var m in KHMER_RUN.Matches(text))
        {
            if (m.Index > at) pieces.Add(new Piece(text[at..m.Index], at, m.Index));
            var off = m.Index;
            var words = SegmentRun(m.Value);
            for (var i = 0; i < words.Count; i++)
            {
                if (i > 0) pieces.Add(new Piece(ZWSP, off, off)); // the boundary is INSERTED: a point
                pieces.Add(new Piece(words[i], off, off + words[i].Length));
                off += words[i].Length;
            }
            at = m.Index + m.Length;
        }
        if (at < text.Length) pieces.Add(new Piece(text[at..], at, text.Length));
        return Rebuilt(text, pieces);
    }
}

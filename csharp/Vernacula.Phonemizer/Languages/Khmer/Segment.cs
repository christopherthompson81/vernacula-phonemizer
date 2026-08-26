/**
 * Khmer word segmentation — a maximal Khmer run → its words, by unigram Viterbi over ZWSP-harvested word
 * frequencies. The FALLBACK boundary source for the ៗ rule when the perceptron's weight table is absent.
 * Ported from src/languages/khmer/segment.ts — see that file for the accuracy measurements.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Khmer;

public static class Segment
{
    /** word → occurrence count, harvested from writer-typed ZWSP boundaries. */
    private static readonly Dictionary<string, double> FREQ = LoadTsv.LoadTsvMapV<double>(
        "languages/khmer",
        "km-wordfreq.tsv",
        (v, _) =>
        {
            var n = Js.Number(v);
            return double.IsFinite(n) && n > 0 ? n : (double?)null;
        },
        optional: true);

    private static readonly double TOTAL = FREQ.Values.Sum();

    /** Longest vocabulary entry — the Viterbi window. */
    private static readonly int MAX_WORD = Math.Min(24, FREQ.Keys.Aggregate(1, (m, w) => Math.Max(m, w.Length)));

    private static readonly double OOV_PER_CHAR = TOTAL == 0 ? 1 : Math.Log(TOTAL * 100);
    private const double SEGMENT_PENALTY = 1;

    private static double Cost(string span) =>
        SEGMENT_PENALTY + (FREQ.TryGetValue(span, out var n) ? Math.Log(TOTAL / n) : OOV_PER_CHAR * span.Length);

    private static readonly Dictionary<string, IReadOnlyList<string>> Memo = new(StringComparer.Ordinal);
    private const int MEMO_CAP = 20_000;
    private static readonly object MemoGate = new();

    /** Split one maximal Khmer run into words; `[run]` when the vocabulary is unavailable. */
    public static IReadOnlyList<string> SegmentKhmer(string run)
    {
        if (run == "" || FREQ.Count == 0 || run.Length == 1) return new[] { run };
        lock (MemoGate)
            if (Memo.TryGetValue(run, out var hit))
                return hit;

        var n = run.Length;
        var best = new double[n + 1];
        for (var i = 0; i <= n; i++) best[i] = double.PositiveInfinity;
        var back = new int[n + 1];
        best[0] = 0;
        for (var i = 1; i <= n; i++)
            for (var len = 1; len <= Math.Min(MAX_WORD, i); len++)
            {
                var prev = best[i - len];
                if (double.IsPositiveInfinity(prev)) continue;
                var c = prev + Cost(run.Substring(i - len, len));
                if (c < best[i]) { best[i] = c; back[i] = len; }
            }

        var @out = new List<string>();
        for (var i = n; i > 0;) { var len = back[i]; @out.Add(run.Substring(i - len, len)); i -= len; }
        @out.Reverse();
        lock (MemoGate)
            if (Memo.Count < MEMO_CAP)
                Memo[run] = @out;
        return @out;
    }

    /** The LAST word of a run — what the iteration mark ៗ needs. */
    public static string LastKhmerWord(string run)
    {
        var parts = SegmentKhmer(run);
        return parts.Count > 0 ? parts[^1] : run;
    }
}

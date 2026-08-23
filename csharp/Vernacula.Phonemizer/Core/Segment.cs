/**
 * Shared DAG maximal-matching core for the SPACELESS-script segmenters (Thai, Burmese, …). Covers a code-point
 * run with the FEWEST dictionary words, with every word boundary required to be in `bound` (the language's legal
 * boundary positions — Thai TCC clusters, Burmese syllable starts — so a word never begins or ends mid-cluster).
 * Runs of out-of-dictionary clusters coalesce into ONE unknown token (graceful: the caller phonemizes it whole).
 */
namespace Vernacula.Phonemizer.Core;

public static class Segment
{
    /** Load a `seg-words.txt` beside `metaUrl` (one word per line, `#` comments skipped) into a set + its longest
     *  entry (which bounds the DAG scan). Shared by the spaceless-script segmenters. `reduce` (not Math.max(...spread))
     *  so a ~65k-entry set can't blow the call-argument limit. */
    public static (HashSet<string> Set, int MaxLen) LoadSegWords(string moduleDir)
    {
        var set = new HashSet<string>();
        foreach (var l in LoadTsv.LoadLines(moduleDir, "seg-words.txt", optional: true))
        {
            var w = l.Trim();
            if (w.Length > 0) set.Add(w);
        }
        var maxLen = 1;
        foreach (var w in set) maxLen = Math.Max(maxLen, Js.CodePoints(w).Count);
        return (set, maxLen);
    }

    /** Cover `cs` with the fewest dictionary `words`, boundaries constrained to `bound`; OOV runs coalesce to one token. */
    public static List<string> SegmentByDag(
        IReadOnlyList<string> cs,
        IReadOnlySet<string> words,
        int maxLen,
        HashSet<int> bound)
    {
        var n = cs.Count;
        if (n == 0) return new List<string>();
        bool IsStart(int i) => i == 0 || bound.Contains(i);
        string Join(int from, int to) => string.Concat(cs.Skip(from).Take(to - from));
        var dp = new double[n + 1];
        Array.Fill(dp, double.PositiveInfinity);
        var next = new int[n + 1];
        Array.Fill(next, -1);
        dp[n] = 0;
        for (var i = n - 1; i >= 0; i--)
        {
            if (!IsStart(i)) continue; //                     words start only at a boundary
            for (var len = 1; len <= Math.Min(maxLen, n - i); len++)
            {
                var j = i + len;
                if (!bound.Contains(j)) continue; //                 …and end only at a boundary
                if (words.Contains(Join(i, j)) && dp[j] + 1 < dp[i])
                {
                    dp[i] = dp[j] + 1;
                    next[i] = j;
                }
            }
            if (double.IsPositiveInfinity(dp[i]))
            {
                //                       fallback: the single cluster here (advance to the next boundary)
                var j = i + 1;
                while (j < n && !bound.Contains(j)) j++;
                dp[i] = dp[j] + 1;
                next[i] = j;
            }
        }
        // Reconstruct; coalesce consecutive OUT-OF-DICTIONARY clusters into one unknown word.
        var outp = new List<string>();
        for (var i = 0; i < n;)
        {
            var j = next[i];
            if (!words.Contains(Join(i, j)))
            {
                var k = j;
                while (k < n)
                {
                    var nk = next[k];
                    if (words.Contains(Join(k, nk))) break;
                    k = nk;
                }
                outp.Add(Join(i, k));
                i = k;
            }
            else
            {
                outp.Add(Join(i, j));
                i = j;
            }
        }
        return outp;
    }
}

/**
 * Thai word segmentation (authored).
 * Ported from src/languages/thai/segment.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Thai;

public static class ThaiSegment
{
    /** Codepoint indices (1..n) at which a TCC cluster ENDS — the only LEGAL word-boundary
     *  positions for segmentThai, so a word is never split mid-cluster (เนี่ย stays whole). */
    private static HashSet<int> ThaiTccBoundaries(IReadOnlyList<string> cs)
    {
        var bounds = new HashSet<int>();
        var p = 0;
        while (p < cs.Count)
        {
            var m = Manifest.THAI_TCC_RE.Match(string.Concat(cs.Skip(p)));
            p += m.Success ? Js.CodePoints(m.Value).Count : 1;
            bounds.Add(p);
        }
        return bounds;
    }

    /**
     * Segment a Thai run into words by DAG maximal-matching (FEWEST tokens) over `words`, with word
     * boundaries CONSTRAINED to TCC cluster boundaries. An out-of-dictionary run coalesces into ONE token.
     */
    public static List<string> SegmentThai(string text, IReadOnlySet<string> words, int maxLen)
    {
        var cs = Js.CodePoints(text);
        if (cs.Count == 0) return new List<string>();
        return Core.Segment.SegmentByDag(cs, words, maxLen, ThaiTccBoundaries(cs));
    }

    private static (HashSet<string> Set, int MaxLen)? WORDS;
    private static readonly object GATE = new();
    private static (HashSet<string> Set, int MaxLen) Words()
    {
        lock (GATE) return WORDS ??= Core.Segment.LoadSegWords("languages/thai");
    }

    /**
     * Segment a Thai token into words via the seg-words DAG (a single in-dictionary word comes back
     * unchanged).
     */
    public static List<string> Segment(string text)
    {
        var (set, maxLen) = Words();
        if (set.Count == 0) return new List<string> { text };
        return SegmentThai(text, set, maxLen);
    }
}

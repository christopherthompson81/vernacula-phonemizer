namespace Vernacula.Phonemizer.Core;

/**
 * Normalizer provenance — #1150 stage 2. Ported from src/core/provenance.ts; see that file for the evidence.
 *
 * ⚠ THE SEAM IS BETTER HERE THAN IN THE TYPESCRIPT, and it is worth saying why rather than mirroring the TS
 * shape out of habit. The TS normalizers call `s.replace(re, rep)` — the STRING is the receiver — so there
 * was no single place to instrument and 3,203 call sites had to be rewritten. The C# port calls
 * `RE.Replace(s, rep)` — the JsRe is the receiver — so every one of the 2,280 normalizer sites already funnels
 * through two methods on one type. Nothing in Languages/ changes.
 *
 * ⚠ AND THAT BREADTH IS EXACTLY WHY TRACKING MUST BE FROZEN. `JsRe.Replace` is not used only by normalizers:
 * engines rewrite IPA with it too (the accent variants, the post-assembly passes). Those operate on a
 * DIFFERENT string, so left running they would desync the mapping and destroy it. `Freeze()` is called when
 * the engine declares its normalized text, which is after normalization and before anything reads output.
 */
public static class Provenance
{
    /// <summary>prov[i] = [Start,End) of the ORIGINAL input that character i of the current string came from.</summary>
    [ThreadStatic]
    private static (int Start, int End)[]? prov;
    [ThreadStatic]
    private static bool frozen;

    /// <summary>Seed the mapping with `input` as the origin. Called by the trace recorder only.</summary>
    public static void Seed(string input)
    {
        if (Foreign.HostDepth() > 1) return;
        // ⚠ CODE UNITS, matching every other offset in the trace. The TS seeded with a code-POINT iteration
        // and one astral character made the array short.
        prov = new (int, int)[input.Length];
        for (var i = 0; i < input.Length; i++) prov[i] = (i, i + 1);
        frozen = false;
    }

    /// <summary>Stop accumulating: everything after this is output, not input.</summary>
    public static void Freeze() => frozen = true;

    public static void End()
    {
        if (Foreign.HostDepth() > 1) return;
        prov = null;
        frozen = false;
    }

    /**
     * The mapping, or null when it cannot be trusted.
     * ⚠ LENGTH IS THE COMPLETENESS CHECK — a transformation that did not report still changed the string, so
     * the array falls out of step and is WITHHELD rather than reported wrong.
     */
    public static (int Start, int End)[]? For(string normalized) =>
        prov is not null && prov.Length == normalized.Length ? prov : null;

    /// <summary>The [Start,End) in the input that produced [from,to) of the normalized string.</summary>
    public static (int Start, int End)? InputSpan((int Start, int End)[] p, int from, int to)
    {
        var lo = int.MaxValue;
        var hi = int.MinValue;
        for (var i = from; i < to && i < p.Length; i++)
        {
            if (p[i].Start < lo) lo = p[i].Start;
            if (p[i].End > hi) hi = p[i].End;
        }
        return lo == int.MaxValue ? null : (lo, hi);
    }

    /// <summary>A tracker for one Replace call, or null when nothing is being recorded.</summary>
    public sealed class Track
    {
        private readonly (int Start, int End)[] source;
        private readonly List<(int Start, int End)> next;
        internal Track((int Start, int End)[] src, int hint)
        {
            source = src;
            next = new List<(int, int)>(hint);
        }

        /// <summary>Carry `len` untouched characters starting at `at`.</summary>
        public void Copy(int at, int len)
        {
            for (var i = at; i < at + len; i++) next.Add(source[i]);
        }

        /// <summary>Stamp the whole match's span across `outLen` characters of replacement.</summary>
        public void Stamp(int at, int len, int outLen)
        {
            (int Start, int End) sp;
            if (len == 0)
            {
                // a zero-width match is an INSERTION: the point, not a range
                sp = at < source.Length ? (source[at].Start, source[at].Start)
                    : at > 0 ? (source[at - 1].End, source[at - 1].End) : (0, 0);
            }
            else
            {
                var lo = int.MaxValue;
                var hi = int.MinValue;
                for (var i = at; i < at + len && i < source.Length; i++)
                {
                    if (source[i].Start < lo) lo = source[i].Start;
                    if (source[i].End > hi) hi = source[i].End;
                }
                sp = lo == int.MaxValue ? (0, 0) : (lo, hi);
            }
            for (var i = 0; i < outLen; i++) next.Add(sp);
        }

        /// <summary>Adopt the accumulated mapping, or drop it if it does not describe `result`.</summary>
        public void Commit(string result)
        {
            if (next.Count != result.Length) { prov = null; return; } // our own accounting failed: drop it
            prov = next.ToArray();
        }
    }

    /**
     * Begin tracking one Replace, or return null.
     *
     * ⚠ A LENGTH MISMATCH MEANS "NOT THE TRACKED STRING", AND IS IGNORED — NOT POISONED, which is where this
     * diverges from the TypeScript deliberately. There, `tr` is called only by normalizers on the pipeline
     * string, so a mismatch can only mean a step went unseen. Here the seam is `JsRe.Replace`, which the whole
     * codebase uses for incidental string work: the first offender found was `Initialisms.MakeUnreadableTest`
     * running inside a STATIC CONSTRUCTOR to build a lookup table, on a string of length 8 while the pipeline
     * held 22. Poisoning on those destroyed the mapping for most of the fleet.
     *
     * ⚠ AND IGNORING IS STILL SAFE, because completeness is enforced at the END rather than per call: the
     * array is never REBUILT over a shifted string — it simply stops being updated — so if a real pipeline
     * step goes unseen, `For(normalized)` finds the length disagreeing and withholds the mapping. What must
     * never happen is a rebuild at the new length, which is exactly the TS defect.
     */
    public static Track? StartTrack(string input)
    {
        var p = prov;
        if (p is null || frozen || Foreign.HostDepth() > 1) return null;
        if (p.Length != input.Length) return null; // a different string, not a missed step
        return new Track(p, input.Length);
    }
}

namespace Vernacula.Phonemizer.Core;

/**
 * Normalizer provenance — #1150 stage 2. Ported from src/core/provenance.ts; see that file for the evidence.
 *
 * ⚠ THE SEAM IS `Rewriter.Rewrite`, NOT `JsRe.Replace`, and the history matters because the earlier shape
 * looked strictly better. Instrumenting `JsRe.Replace` needed no edits under Languages/ at all — every
 * normalizer site already funnelled through it — where the TypeScript had to rewrite 3,203 call sites by
 * hand. But breadth is not the same as precision: the method is also how a static constructor builds a
 * lookup table and how an engine rewrites IPA, so the mapping could not tell "a step I did not see" from
 * "a string that is not mine", and had to tolerate both. Two wrong-span defects came through that tolerance.
 * The seam is now the narrow one the TS uses, and the two engines carry ONE mismatch rule.
 *
 * ⚠ TRACKING IS STILL FROZEN AT THE ENGINE BOUNDARY. Even a narrow seam cannot see the difference between a
 * normalizer and a post-assembly pass that happens to call it; `Freeze()` is called when the engine declares
 * its normalized text, which is after normalization and before anything reads output.
 */
public static class Provenance
{
    /// <summary>prov[i] = [Start,End) of the ORIGINAL input that character i of the current string came from.</summary>
    [ThreadStatic]
    private static (int Start, int End)[]? prov;
    /**
     * ⚠ THE STRING THE MAPPING DESCRIBES — length alone cannot carry the guarantee, and two separate defects
     * proved it. (a) `Mandarin.SubstituteNumbers` rewrites a code-point list OUTSIDE the seam and is NET
     * length-preserving (`115`→`一百一十五` is +2, each `10`→`十` is −1), so a stale identity mapping passed a
     * length check and reported `十` as coming from a SPACE. (b) `Initialisms` runs
     * `CLASS_BRACKETS.Replace("[aeiouy]", "")` inside a static initializer — 8 characters — and any pipeline
     * string of length 8 adopted its 6-entry result. Every language had its own poisoned length, once per
     * process, on the first cold trace. Comparing content costs O(n) on the traced path only.
     */
    [ThreadStatic]
    private static string? tracked;
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
        tracked = input;
        frozen = false;
    }

    /// <summary>Is a mapping being accumulated right now? See <see cref="Rewriter.Tracing"/>.</summary>
    public static bool IsRecording() => prov is not null && !frozen && Foreign.HostDepth() <= 1;

    /// <summary>Stop accumulating: everything after this is output, not input.</summary>
    public static void Freeze() => frozen = true;

    public static void End()
    {
        if (Foreign.HostDepth() > 1) return;
        prov = null;
        tracked = null;
        frozen = false;
    }

    /**
     * The mapping, or null when it cannot be trusted.
     * ⚠ LENGTH IS THE COMPLETENESS CHECK — a transformation that did not report still changed the string, so
     * the array falls out of step and is WITHHELD rather than reported wrong.
     */
    public static (int Start, int End)[]? For(string normalized) =>
        prov is not null && tracked == normalized ? prov : null;

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
        // ⚠ REPORTED TOO — this branch means the accounting in `Track` failed, a worse fault than a missed
        // pipeline step, and it was the only way to lose the mapping without saying so.
        if (next.Count != result.Length) { poisonSink?.Invoke(tracked ?? "", result); Poison(); return; }
            prov = next.ToArray();
            tracked = result;
        }
    }

    /**
     * A diagnostic sink for the poison, off by default and free when unset. Mirrors the TypeScript's
     * `onPoison`, and exists for the same reason: only the stack can tell a pipeline step that an earlier
     * unconverted step already desynced from a call on a SUBSTRING that never belonged on the seam.
     */
    [ThreadStatic]
    private static Action<string, string>? poisonSink;
    public static void OnPoison(Action<string, string>? fn) => poisonSink = fn;

    /**
     * ⚠ ONCE DESYNCED, STAY DESYNCED. Rebuilding the array at the CURRENT string's length would
     * re-synchronise the length check over shifted values, and `For`'s check — the whole safety net — would
     * then pass and report them as fact.
     */
    private static void Poison()
    {
        prov = null;
        tracked = null;
    }

    /**
     * Begin tracking one rewrite of the pipeline string, or return null.
     *
     * ⚠ A MISMATCH POISONS, matching the TypeScript exactly. It did not always: while provenance lived inside
     * `JsRe.Replace`, an unrecognised string usually meant incidental work by some unrelated caller — the
     * first offender was `Initialisms` building a lookup table in a STATIC CONSTRUCTOR, on a string of length
     * 8 while the pipeline held 22 — so poisoning on those would have destroyed the mapping fleet-wide, and
     * the rule had to be "ignore". Now that only `Rewriter.Rewrite` reaches here, an unrecognised string can
     * only mean a pipeline step went unseen, which is precisely the thing the mapping must never paper over.
     */
    /// <summary>Drop the mapping, for a rebuild that could not verify its own accounting.</summary>
    internal static void PoisonExternally(string expected, string got)
    {
        poisonSink?.Invoke(expected, got);
        Poison();
    }

    public static Track? StartTrack(string input)
    {
        var p = prov;
        if (p is null || frozen || Foreign.HostDepth() > 1) return null;
        if (tracked != input)
        {
            poisonSink?.Invoke(tracked ?? "", input);
            Poison();
            return null;
        }
        return new Track(p, input.Length);
    }
}

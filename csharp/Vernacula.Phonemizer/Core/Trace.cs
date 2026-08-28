namespace Vernacula.Phonemizer.Core;

/**
 * The trace recorder behind `Phonemizer.PhonemizeTrace` (#1150 stage 1).
 * Ported from src/core/trace.ts — see that file for the evidence and the design argument.
 *
 * ⚠ [ThreadStatic], matching `Foreign`'s host stack: the recorder is ambient state scoped to one synchronous
 * render, and the parity tool runs languages concurrently.
 */

/** One token as the tokenizer matched it, with what happened to it on the way to IPA. */
public sealed class TraceToken
{
    public int Start { get; init; }
    public int End { get; init; }
    public string Surface { get; init; } = "";
    /** What the nativiser rewrote it to before the g2p saw it. Null when nothing was rewritten. */
    public string? Nativised { get; set; }
    /** What this token EMITTED — not necessarily a substring of the final reading; see TraceRewrite. */
    public List<string> Emitted { get; } = new();
}

/** A whole-string rewrite applied to an assembled reading, or to the input before tokenizing. */
public sealed class TraceRewrite
{
    public string Stage { get; init; } = "";
    public string Before { get; init; } = "";
    public string After { get; init; } = "";
}

public sealed class TraceResult
{
    public string Normalized { get; set; } = "";
    public bool Traced { get; set; }
    public List<TraceToken> Tokens { get; } = new();
    public List<TraceRewrite> Rewrites { get; } = new();
}

public static class Trace
{
    private sealed class Recording
    {
        public string Input = "";
        public TraceResult Result = new();
        public TraceToken? Current;
        public int TokenDepth;
    }

    [ThreadStatic]
    private static Recording? recording;

    // Recording, and at the TOP-LEVEL render. The nesting signal is the registry's own host stack, not a
    // counter kept here — the wrapper pushes a host for EVERY language, including the four that hand-roll
    // their tokenizer loop, so counting delegations at the seam would miss exactly those.
    private static bool Active => recording != null && Foreign.HostDepth() <= 1;

    public static void Start(string input)
    {
        recording = new Recording { Input = input };
    }

    public static TraceResult Stop()
    {
        var r = recording?.Result ?? new TraceResult();
        recording = null;
        return r;
    }

    /** Enter a seam engine. The FIRST one at the top level owns the recording. */
    public static void EnterEngine(string normalized)
    {
        if (!Active || recording == null || recording.Result.Traced) return;
        recording.Result.Normalized = normalized;
        recording.Result.Traced = true;
        // Normalization is reported for every engine at once here: the caller's string and the string the
        // tokenizer sees are both known, and their difference IS the normalization.
        NoteRewrite("normalize", recording.Input, normalized);
    }

    public static void ExitEngine()
    {
        // nothing to unwind: HostDepth scopes a nested engine, not a counter here
    }

    /**
     * Open a token. ⚠ RE-ENTRANT: `EmitUnclaimed` is called both from the gap loop (where it introduces a
     * token of its own) and from inside a handler (hmong), where the readings belong to the token already
     * open. Outermost wins. ⚠ And only once an engine has DECLARED itself, or an engine driving ClauseSink
     * without EnterEngine would emit tokens against an empty Normalized.
     */
    public static void BeginToken(int start, int end, string surface)
    {
        if (!Active || recording == null || !recording.Result.Traced) return;
        recording.TokenDepth++;
        if (recording.TokenDepth > 1) return;
        recording.Current = new TraceToken { Start = start, End = end, Surface = surface };
        recording.Result.Tokens.Add(recording.Current);
    }

    public static void EndToken()
    {
        // ⚠ GATED THE SAME WAY BeginToken IS. Ungated, a nested engine's EndToken calls decrement the OUTER
        // engine's depth against increments that never happened, closing its token early.
        if (!Active || recording == null) return;
        if (recording.TokenDepth > 0) recording.TokenDepth--;
        if (recording.TokenDepth == 0) recording.Current = null;
    }

    /** Record a COMPLETE token — the hook for a two-phase pipeline that cannot bracket its emits. */
    public static void NoteToken(int start, int end, string surface, IEnumerable<string> emitted, string? nativised = null)
    {
        if (!Active || recording == null || !recording.Result.Traced) return;
        var t = new TraceToken { Start = start, End = end, Surface = surface };
        foreach (var e in emitted) if (e.Length > 0) t.Emitted.Add(e);
        if (nativised != null && nativised != surface) t.Nativised = nativised;
        recording.Result.Tokens.Add(t);
    }

    /** Record what the nativiser did to the token currently open. */
    public static void NoteNativised(string from, string to)
    {
        if (!Active || recording?.Current == null || from == to) return;
        recording.Current.Nativised = to;
    }

    /** Record one emitted reading against the token currently open. */
    public static void NoteEmit(string ipa)
    {
        if (!Active || recording?.Current == null || ipa.Length == 0) return;
        recording.Current.Emitted.Add(ipa);
    }

    /** Record a whole-string rewrite. A no-op when nothing changed. */
    public static void NoteRewrite(string stage, string before, string after)
    {
        if (!Active || recording == null || before == after) return;
        recording.Result.Rewrites.Add(new TraceRewrite { Stage = stage, Before = before, After = after });
    }
}

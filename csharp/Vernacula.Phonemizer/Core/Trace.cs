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
    /**
     * [Start,End) into the CALLER's input, when normalizer provenance is complete for this engine (#1150
     * stage 2). ⚠ NULL MEANS "NOT KNOWN", NEVER "IDENTICAL" — an unreported step desyncs the mapping and it
     * is withheld rather than reported wrong.
     */
    public (int Start, int End)? InputSpan { get; set; }

    /**
     * `[Start,End)` into the trace's `Ipa` — where this token's contribution ENDED UP (#1150 stage 3).
     *
     * ⚠ THIS IS THE HALF THAT CLOSES THE LOOP. `InputSpan` says which characters the reader typed; this says
     * which characters of the reading they became. Together they are a two-way index between orthography and
     * IPA, which is what a player needs to highlight a word while its audio plays.
     *
     * ⚠ ABSENT MEANS "NOT KNOWN", as everywhere else here. Eight engines rewrite the assembled string after
     * the clause assembler; six do it one character for one and keep their spans, while `as` collapses a
     * doubled aspirate and `fr-CA` applies an accent that change LENGTHS — and an offset into the
     * pre-rewrite string would be a confident wrong answer about the post-rewrite one. See `NoteRewrite`'s
     * `positional` flag for which claim each pass makes.
     */
    public (int Start, int End)? IpaSpan { get; set; }
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
        /**
         * Where each token's emissions landed in the ASSEMBLED reading (#1150 stage 3). A null value marks a
         * token with an emission that could not be placed — withheld whole rather than reported from a
         * partial union.
         */
        public readonly Dictionary<TraceToken, (int Start, int End)?> Spans = new();
        /** The reading as the clause assembler built it, before any post-assembly rewrite. */
        public string? Assembled;
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
        Provenance.Seed(input);
    }

    public static TraceResult Stop(string? ipa = null)
    {
        var r = recording?.Result ?? new TraceResult();
        // ⚠ RESOLVED AT STOP, not per token: a token is opened while the normalized string is still being
        // tokenized, and the mapping is only complete once normalization has finished.
        var p = Provenance.For(r.Normalized);
        if (p is not null)
            foreach (var t in r.Tokens)
            {
                var span = Provenance.InputSpan(p, t.Start, t.End);
                if (span is not null) t.InputSpan = span;
            }
        // ⚠ THE OUTPUT SPANS ARE ONLY OFFERED IF THE STRING THEY INDEX SURVIVED. The emission offsets are
        // into the ASSEMBLED reading; a post-assembly pass that is not one-character-for-one invalidates
        // them, and an offset into the pre-rewrite string is a confident wrong answer about the one the
        // caller receives.
        if (ipa is not null && recording is not null && recording.Assembled == ipa)
            foreach (var t in r.Tokens)
                if (recording.Spans.TryGetValue(t, out var sp) && sp is not null) t.IpaSpan = sp;
        Provenance.End();
        recording = null;
        return r;
    }

    /** Enter a seam engine. The FIRST one at the top level owns the recording. */
    public static void EnterEngine(string normalized)
    {
        if (!Active || recording == null || recording.Result.Traced) return;
        recording.Result.Normalized = normalized;
        recording.Result.Traced = true;
        // ⚠ FREEZE HERE. `JsRe.Replace` is the provenance seam, and engines also rewrite IPA through it
        // (accent variants, post-assembly passes). Those act on a DIFFERENT string, so left running they
        // would desync the mapping and destroy it. Normalization is finished by this point.
        Provenance.Freeze();
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
    /**
     * ⚠ THE TWO-PHASE ENGINES MUST PASS `ipaSpan` THEMSELVES. They never open a token while its reading is
     * being made, so `NoteEmit`'s offset never reaches them; what they DO know is which slot of their own
     * parts list each reading went into, which is the same fact one step earlier.
     */
    public static void NoteToken(int start, int end, string surface, IEnumerable<string> emitted,
        string? nativised = null, (int Start, int End)? ipaSpan = null)
    {
        if (!Active || recording == null || !recording.Result.Traced) return;
        var t = new TraceToken { Start = start, End = end, Surface = surface };
        foreach (var e in emitted) if (e.Length > 0) t.Emitted.Add(e);
        if (nativised != null && nativised != surface) t.Nativised = nativised;
        if (ipaSpan is not null) recording.Spans[t] = ipaSpan;
        recording.Result.Tokens.Add(t);
    }

    /** Record what the nativiser did to the token currently open. */
    public static void NoteNativised(string from, string to)
    {
        if (!Active || recording?.Current == null || from == to) return;
        recording.Current.Nativised = to;
    }

    /** Record one emitted reading against the token currently open. */
    public static void NoteEmit(string ipa, int? at = null)
    {
        if (!Active || recording?.Current == null || ipa.Length == 0) return;
        var t = recording.Current;
        t.Emitted.Add(ipa);
        // ⚠ KEYED ON THE TOKEN OBJECT, not stored on it: `TraceToken` is the public shape, and offsets that
        // may yet be disbelieved do not belong on it. One emission with no place withholds the token whole.
        var has = recording.Spans.TryGetValue(t, out var cur);
        if (at is null) { recording.Spans[t] = null; return; }
        if (has && cur is null) return;
        recording.Spans[t] = has && cur is not null
            ? (Math.Min(cur.Value.Start, at.Value), Math.Max(cur.Value.End, at.Value + ipa.Length))
            : (at.Value, at.Value + ipa.Length);
    }

    /**
     * The reading as the clause assembler built it, before any post-assembly rewrite.
     * ⚠ RECORDED SO IT CAN BE DISBELIEVED: the emission offsets index THIS string, and `Stop` offers them as
     * `IpaSpan` only when it is still what the caller receives.
     */
    public static void NoteAssembled(string s)
    {
        if (!Active || recording == null) return;
        recording.Assembled = s;
    }

    /** Record a whole-string rewrite. A no-op when nothing changed. */
    public static void NoteRewrite(string stage, string before, string after, bool positional = false)
    {
        if (!Active || recording == null || before == after) return;
        recording.Result.Rewrites.Add(new TraceRewrite { Stage = stage, Before = before, After = after });
        // ⚠ `positional` IS A CLAIM THE PASS MAKES, AND THE LENGTH IS WHAT VERIFIES IT (#1150 stage 3). It
        // means "every offset still means the same thing" — a one-for-one substitution such as Spanish's
        // spirantization (ɡ→ɣ, b→β, d→ð). Without it the default is WITHHOLDING, which is the right default:
        // `Assembled` stops matching the final reading and `Stop` offers no span at all.
        // ⚠ THE CLAIM IS NOT FULLY CHECKABLE — equal lengths do not rule out a REORDERING. What rules that
        // out is that these passes are character substitutions, a property of the functions rather than of
        // this check; the tests verify the consequence instead.
        if (positional && before.Length == after.Length && recording.Assembled == before) recording.Assembled = after;
    }
}

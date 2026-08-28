/**
 * Assemble a phonemizer's text() output from its tokenizer.
 * Ported from src/core/clauses.ts — see that file for the corpus evidence.
 */
using System.Text.RegularExpressions;

namespace Vernacula.Phonemizer.Core;

public interface ClauseSink
{
    /**
     * Append a phonemized token, space-joined; flushes any pending pause before it. Empty strings are
     * ignored.
     */
    void Emit(string ipa);
    /**
     * Set a pending clause pause (rendered before the next emitted token). No-op while the output is still
     * empty.
     */
    void Pause(string mark);
}

public static class Clauses
{
    /** The clause-assembly state machine, independent of how tokens are iterated. */
    public static (ClauseSink sink, Func<string> finish) ClauseSink()
    {
        var impl = new SinkImpl();
        return (impl, impl.Finish);
    }

    private sealed class SinkImpl : ClauseSink
    {
        private string @out = "";
        private string? pending = null;

        public void Emit(string ipa)
        {
            if (ipa == "") return;
            Trace.NoteEmit(ipa);
            if (@out == "") @out = ipa;
            else if (pending != null)
            {
                @out += $" {pending} {ipa}";
                pending = null;
            }
            else @out += $" {ipa}";
        }

        public void Pause(string mark)
        {
            if (@out != "") pending = mark;
        }

        public string Finish()
        {
            if (pending != null && @out != "") @out += $" {pending}";
            return @out;
        }
    }

    /** A run of Latin-script text (with its combining marks, apostrophes and internal hyphens). */
    // C# PORT NOTE: module-private and UNREFERENCED in the TS source too; kept `internal` (a private
    // field that is never read would draw CS0414).
    internal static readonly JsRe LATIN_RUN = JsRegex.Compile(@"\p{Script=Latin}[\p{Script=Latin}\p{M}'’-]*", "gu");
    /**
     * A run of letters in ANY script, kept together with its combining marks and internal apostrophes.
     *
     * ⚠ DELIBERATELY LETTERS ONLY, not `\p{Nd}`. A digit is script-marked but language-NEUTRAL in value, so
     * `٢٠٢٤` in English text is 2024 and wants an English reading; the registry folds native digits to ASCII
     * before any engine sees them, which is a better answer than routing them by script.
     *
     * ⚠ A TRAILING SUPERSCRIPT TRAVELS WITH THE RUN, because it belongs to the foreign expression and not to
     * the host: a letters-only run ends `E = mc²` at `mc` and the exponent is left in the gap and DROPPED.
     * Only trailing, and only the superscript digits — a superscript cannot begin a word, so this can never
     * start a run that would not otherwise exist.
     */
    public static readonly JsRe FOREIGN_RUN =
        JsRegex.Compile(@"[\p{L}\p{M}][\p{L}\p{M}'’-]*[\u2070\u00b9\u00b2\u00b3\u2074-\u2079]*", "gu");

    private static readonly JsRe LatinOne = JsRegex.Compile(@"\p{Script=Latin}", "u");

    /** Emit the FOREIGN runs inside text the engine's own tokenizer did not claim. */
    public static void EmitUnclaimed(string gap, ClauseSink sink, int baseOffset = 0)
    {
        foreach (Match m in FOREIGN_RUN.Matches(gap))
        {
            var run = m.Value;
            // ⚠ AN UNCLAIMED RUN IS STILL A TOKEN (#1150): its reading reaches the output, so leaving it out
            // would attribute real IPA to no token. `baseOffset` is the gap's offset in the caller's string.
            Trace.BeginToken(baseOffset + m.Index, baseOffset + m.Index + run.Length, run);
            var routed = Foreign.ReadForeignRun(run);
            if (routed != null)
            {
                if (routed != "") sink.Emit(routed);
                Trace.EndToken();
                continue;
            }
            if (!LatinOne.IsMatch(run)) { Trace.EndToken(); continue; }
            var foreign = Foreign.GetDefaultForeign();
            if (foreign != null) sink.Emit(foreign(run));
            Trace.EndToken();
        }
    }

    public static string AssembleClauses(
        string input,
        JsRe token,
        Action<Match, ClauseSink> handle)
    {
        var (sink, finish) = ClauseSink();
        // The trace is derived here and nowhere else (#1150): `at`/`cursor` were already computed and
        // discarded, and a token's span is that arithmetic kept.
        Trace.EnterEngine(input);
        try
        {
            var cursor = 0;
            foreach (Match m in JsRegex.MatchAll(token, input))
            {
                var at = m.Index; // TS `m.index ?? cursor` — a .NET Match always carries its index
                if (at > cursor) EmitUnclaimed(input[cursor..at], sink, cursor);
                Trace.BeginToken(at, at + m.Value.Length, m.Value);
                handle(m, sink);
                Trace.EndToken();
                cursor = at + m.Value.Length;
            }
            if (cursor < input.Length) EmitUnclaimed(input[cursor..], sink, cursor);
            return finish();
        }
        finally { Trace.ExitEngine(); }
    }
}

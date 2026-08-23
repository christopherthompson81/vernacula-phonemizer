/**
 * Assemble a phonemizer's text() output from its tokenizer. Collapses the identical `out`/`pending` + `emit`
 * closure + final-flush skeleton that every language's text() repeats: phonemized tokens are space-joined, and a
 * clause-punctuation mark becomes a PENDING pause attached BEFORE the next emitted token (never trailing an empty
 * output, never doubled). Only the per-token dispatch — which regex group is a word / number / punctuation, and
 * how each is phonemized — varies, so the caller supplies a `handle(match, sink)` over `input.matchAll(token)`.
 *
 *   text(input) {
 *     return assembleClauses(input, TOKEN, (m, sink) => {
 *       if (m[1]) sink.emit(phonemizeWord(m[1]));
 *       else if (m[2]) for (const w of numberWords(m[2])) sink.emit(phonemizeWord(w));
 *       else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk) sink.pause(mk); }
 *     });
 *   }
 */
using System.Text.RegularExpressions;

namespace Vernacula.Phonemizer.Core;

public interface ClauseSink
{
    /** Append a phonemized token, space-joined; flushes any pending pause before it. Empty strings are ignored. */
    void Emit(string ipa);
    /** Set a pending clause pause (rendered before the next emitted token). No-op while the output is still empty. */
    void Pause(string mark);
}

public static class Clauses
{
    /**
     * The clause-assembly state machine, independent of how tokens are iterated. `sink` drives it; `finish()`
     * flushes any trailing pause and returns the assembled string. Use this directly when the tokenization isn't a
     * single regex matchAll (mandarin scans code-point Han/Latin runs); use assembleClauses otherwise.
     */
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
     * EXPORTED because two engines cannot use `assembleClauses` and hand-roll their own gap pass —
     * english.ts (a two-phase tagger pipeline) and french.ts (liaison looks one word ahead). One definition,
     * three call sites.
     *
     * ⚠ DELIBERATELY LETTERS ONLY, not `\p{Nd}`. A digit is script-marked but language-NEUTRAL in value, so
     * `٢٠٢٤` in English text is 2024 and wants an English reading, not an Arabic one. The registry folds native
     * digits to ASCII for every language before any engine sees them, which is a better answer than routing them
     * by script.
     *
     * ⚠ A TRAILING SUPERSCRIPT TRAVELS WITH THE RUN, because it belongs to the foreign expression and not to the
     * host. In `E = mc²` the `²` is `No`, not `\p{L}`, so a letters-only run ends at `mc` and the exponent is left
     * in the gap and DROPPED. English reads `mc²` perfectly well once handed the whole thing, so the fix is to
     * stop cutting the expression in half rather than to invent a host-language reading for it.
     * Only TRAILING, and only the superscript digits: a superscript cannot begin a word, so this cannot start a
     * run that would not otherwise exist, and it cannot swallow a following host-language character.
     */
    public static readonly JsRe FOREIGN_RUN =
        JsRegex.Compile(@"[\p{L}\p{M}][\p{L}\p{M}'’-]*[\u2070\u00b9\u00b2\u00b3\u2074-\u2079]*", "gu");

    private static readonly JsRe LatinOne = JsRegex.Compile(@"\p{Script=Latin}", "u");

    /**
     * Emit the FOREIGN runs inside text the engine's own tokenizer did not claim.
     *
     * A run in ANY script is a candidate: the script router is asked first, and only if it declines does the
     * Latin-to-English fallback apply. Everything else in a gap — stray punctuation, whitespace — stays dropped
     * (see core/foreign.ts for why an unclaimed gap loses embedded text entirely).
     */
    public static void EmitUnclaimed(string gap, ClauseSink sink)
    {
        foreach (Match m in FOREIGN_RUN.Matches(gap))
        {
            var run = m.Value;
            // The script router first — it knows which language should read this run. It declines for an
            // unknown script, and for a target equal to the host (which would recurse).
            var routed = Foreign.ReadForeignRun(run);
            if (routed != null)
            {
                if (routed != "") sink.Emit(routed);
                continue;
            }
            // Fallback: the Latin-to-English path, for wherever the router has nothing to say.
            if (!LatinOne.IsMatch(run)) continue;
            var foreign = Foreign.GetDefaultForeign();
            if (foreign != null) sink.Emit(foreign(run));
        }
    }

    public static string AssembleClauses(
        string input,
        JsRe token,
        Action<Match, ClauseSink> handle)
    {
        var (sink, finish) = ClauseSink();
        var cursor = 0;
        foreach (Match m in JsRegex.MatchAll(token, input))
        {
            var at = m.Index; // TS `m.index ?? cursor` — a .NET Match always carries its index
            // Text between the previous match and this one is text the tokenizer declined; an engine whose
            // TOKEN already has a Latin group claims it here and leaves no gap, so this is a no-op for the
            // engines that were already correct.
            if (at > cursor) EmitUnclaimed(input[cursor..at], sink);
            handle(m, sink);
            cursor = at + m.Value.Length;
        }
        if (cursor < input.Length) EmitUnclaimed(input[cursor..], sink);
        return finish();
    }
}

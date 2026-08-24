/**
 * Async neural entry for Persian (fa). The default modern path runs the sentence-level STRUCTURAL TAGGER over
 * each clause and assembles IPA itself, falling back wholesale to the word-level restorer when the model or
 * the ONNX runtime is absent. The sync engine is untouched by this path.
 * Ported from src/languages/persian/persianNeural.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Persian;

public static class PersianNeural
{
    private const string PERSO = "ء-ۿݐ-ݿ‌‍";
    private static readonly JsRe WORD = JsRegex.Compile($"[{PERSO}]+", "gu");
    // Digit group FIRST, so Persian-Indic digits (۰-۹, which also fall in the PERSO letter range) route to
    // the number path instead of being fed to the models. Groups: 1=digits, 2=word, 3=punctuation.
    private static readonly JsRe TOKEN = JsRegex.Compile($"([\\d\\u06F0-\\u06F9]+)|([{PERSO}]+)|([۔؟،؛.?!,;:])", "gu");
    private static readonly JsRe ZWNJ = JsRegex.Compile("[‌‍]", "gu");
    // The models were trained on sentence-length units (≤120 chars, p99≈97); a longer run is
    // out-of-distribution and degenerates, so the chunker below flushes a clause before it exceeds this.
    private const int MAX_CLAUSE_CHARS = 100;
    private static readonly IReadOnlyDictionary<string, string> MARK = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["۔"] = ".", ["؟"] = "?", ["،"] = ",", ["؛"] = ",",
        ["."] = ".", ["?"] = "?", ["!"] = "!", [","] = ",", [";"] = ",", [":"] = ",",
    };
    /** The sync number path only reads ASCII digits; fold Persian-Indic digits (۰-۹) to ASCII first. */
    private static readonly JsRe EASTERN_DIGIT = JsRegex.Compile("[۰-۹]", "gu");
    private static string ToAsciiDigits(string s) =>
        JsRegex.Replace(s, EASTERN_DIGIT, d => Js.NumberToString(d.Value[0] - 0x06f0));

    // ⚠ THE LAZY MODEL HANDLES ARE MEMOIZED PROMISES IN THE TS, so the model is built ONCE per process and
    // every later call awaits the same task. Assignment is guarded by a lock here because .NET can run two
    // callers concurrently where the JS event loop cannot.
    private static readonly object GATE = new();
    private static Task<IFaVowelRestorer?>? restorerP;
    private static Task<IFaContextRestorer?>? modernCtxP;

    /**
     * Default modern Persian phonemization: structural TAGGER per clause, word-level fallback when the model
     * is absent.
     */
    public static async Task<string> PhonemizeFaNeural(string text)
    {
        text = PersianPhonemizer.NormalizePersianOrthography(text); // fold Arabic yeh/kaf → Farsi so the tagger doesn't garble
        // …then the text-normalization pass, so the tagger sees the SAME rewritten text as the sync path, and
        // only bare orthography: its source alphabet carries no harakat.
        text = PersianPhonemizer.NormalizePersianText(text);
        Task<IFaVowelRestorer?> restorerPending;
        Task<IFaContextRestorer?> ctxPending;
        lock (GATE)
        {
            restorerP ??= VowelRestorer.CreateFaVowelRestorer();
            modernCtxP ??= FaTagger.CreateFaTagger();
            restorerPending = restorerP;
            ctxPending = modernCtxP;
        }
        var restorer = await restorerPending.ConfigureAwait(false);
        var ctx = await ctxPending.ConfigureAwait(false);
        if (ctx is null) return await PhonemizeFaWordLevel(text, restorer).ConfigureAwait(false); // no context model → word-at-a-time path

        var lex = PersianPhonemizer.HarakatLex();
        async Task<string> WordLevel(string w) =>
            restorer is not null && Js.CodePoints(w).Count() >= 3 && !lex.ContainsKey(HarakatLexicon.StripHarakat(w))
                ? await restorer.Restore(w).ConfigureAwait(false)
                : PersianPhonemizer.PhonemizeWord(w);

        var ipaQueue = new List<string>();
        var run = new List<string>();
        async Task Flush()
        {
            if (run.Count == 0) return;
            var @out = await ctx.Restore(string.Join(" ", run)).ConfigureAwait(false);
            var ow = @out.Split(" ");
            // The tagger emits one tag per char and only the input's spaces start a new word, so the output
            // aligns 1:1 with the input words by construction; the count fallback is cheap defence only.
            if (ow.Length == run.Count) ipaQueue.AddRange(ow);
            else foreach (var w in run) ipaQueue.Add(await WordLevel(w).ConfigureAwait(false));
            run = new List<string>();
        }
        foreach (var m in JsRegex.MatchAll(TOKEN, text))
        {
            if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                var w = JsRegex.Replace(m.Groups[2].Value, ZWNJ, _ => "");
                var curLen = run.Aggregate(0, (a, x) => a + Js.CodePoints(x).Count() + 1);
                if (run.Count > 0 && curLen + Js.CodePoints(w).Count() > MAX_CLAUSE_CHARS) await Flush().ConfigureAwait(false);
                run.Add(w);
            }
            else
            {
                await Flush().ConfigureAwait(false); // a digit or punctuation break ends the clause run
            }
        }
        await Flush().ConfigureAwait(false);

        var wi = 0;
        // Host pushed around the assembly: every await above has settled, so this is one synchronous turn,
        // which is what Core/Foreign.cs's stack requires. Without it an embedded foreign run has no host and
        // is dropped.
        return Foreign.WithHost("fa", () => Clauses.AssembleClauses(text, TOKEN, (m, sink) =>
        {
            if (m.Groups[2].Success && m.Groups[2].Value.Length > 0) sink.Emit(wi < ipaQueue.Count ? ipaQueue[wi++] : "");
            else if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(Registry.RenderInHost("fa", ToAsciiDigits(m.Groups[1].Value))); // digits → the sync number path
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                var mk = MARK.GetValueOrDefault(m.Groups[3].Value);
                if (mk is not null) sink.Pause(mk);
            }
        }));
    }

    /** The pre-context word-at-a-time path (lexicon → OOV seq2seq → g2p, NO cross-word context). */
    private static async Task<string> PhonemizeFaWordLevel(string text, IFaVowelRestorer? restorer)
    {
        if (restorer is null) return Registry.RenderInHost("fa", text); // no model at all → sync lexicon+default path
        var lex = PersianPhonemizer.HarakatLex();
        var neural = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var m in JsRegex.MatchAll(WORD, text))
        {
            var w = m.Value;
            if (Js.CodePoints(w).Count() >= 3 && !lex.ContainsKey(HarakatLexicon.StripHarakat(w)) && !neural.ContainsKey(w))
                neural[w] = await restorer.Restore(w).ConfigureAwait(false);
        }
        return Foreign.WithHost("fa", () => Clauses.AssembleClauses(text, TOKEN, (m, sink) =>
        {
            if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                sink.Emit(neural.TryGetValue(m.Groups[2].Value, out var ipa) ? ipa : PersianPhonemizer.PhonemizeWord(m.Groups[2].Value));
            else if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(Registry.RenderInHost("fa", ToAsciiDigits(m.Groups[1].Value)));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                var mk = MARK.GetValueOrDefault(m.Groups[3].Value);
                if (mk is not null) sink.Pause(mk);
            }
        }));
    }

    private static Task<IFaContextRestorer?>? contextP;
    /**
     * The clean-sentence filter: keep only Perso-Arabic letters, the two Persian-specific vowel marks and the
     * space, then collapse the runs.
     * ⚠ NAMED HERE, SPELLED TWICE IN THE TS: both context entry points carry the same chain inline and
     * character-for-character. If the TS ever makes the two differ, this must split again.
     */
    private static readonly JsRe NON_PERSO = JsRegex.Compile("[^ء-ۿٰ-ۓ ]", "gu");
    private static readonly JsRe SPACE_RUN = JsRegex.Compile("\\s+", "gu");
    private static string CleanSentence(string sentence) =>
        JsRegex.Replace(
            JsRegex.Replace(PersianPhonemizer.NormalizePersianOrthography(sentence), NON_PERSO, _ => " "),
            SPACE_RUN, _ => " ").Trim();

    /**
     * OPTIONAL: phonemize a CLASSICAL Persian hemistich/sentence via the sentence-level CONTEXT model, which
     * resolves ezafe / homographs / connectors from context. Classical-scoped, so NOT the default — use
     * PhonemizeFaNeural for modern text. Falls back to the sync path when the model is unavailable.
     */
    public static async Task<string> PhonemizeFaContext(string sentence)
    {
        Task<IFaContextRestorer?> pending;
        lock (GATE)
        {
            contextP ??= ContextRestorer.CreateFaContextRestorer();
            pending = contextP;
        }
        var ctx = await pending.ConfigureAwait(false);
        if (ctx is null) return Registry.GetPhonemizer("fa").Text(sentence);
        var clean = CleanSentence(sentence);
        return clean != "" ? await ctx.Restore(clean).ConfigureAwait(false) : "";
    }

    /**
     * MODERN single-sentence context API — the structural tagger applied to one already-clean sentence, with
     * no digit/punctuation handling. PhonemizeFaNeural is the full default path; falls back to the sync path
     * when the model is unavailable.
     */
    public static async Task<string> PhonemizeFaModernContext(string sentence)
    {
        Task<IFaContextRestorer?> pending;
        lock (GATE)
        {
            modernCtxP ??= FaTagger.CreateFaTagger();
            pending = modernCtxP;
        }
        var ctx = await pending.ConfigureAwait(false);
        if (ctx is null) return Registry.GetPhonemizer("fa").Text(sentence);
        var clean = CleanSentence(sentence);
        return clean != "" ? await ctx.Restore(clean).ConfigureAwait(false) : "";
    }
}

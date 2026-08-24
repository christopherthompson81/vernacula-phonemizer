/**
 * Async neural entry for Persian (fa). The DEFAULT modern path runs the sentence-level STRUCTURAL TAGGER
 * (faTagger.ts, a BiLSTM sequence-labeller) over each clause, because on modern running text sentence context beats
 * the word-level path — it resolves ezafe and homographs, which a word-at-a-time model structurally cannot. The
 * tagger emits one IPA-chunk tag per abjad char, so its output length == input length: it CANNOT degenerate and
 * word counts always align, unlike the seq2seq it replaced. It falls back WHOLESALE to the word-level restorer
 * (lexicon → OOV seq2seq → g2p) when the tagger model / `onnxruntime-node` is absent; the per-word guard below is
 * retained as defence but the tagger's structural word-count invariance means it effectively never fires.
 *
 * This is a SEPARATE async path — the sync engine (and its C#-parity + referee-eval) is untouched. The tagger emits
 * IPA DIRECTLY, so this assembles IPA itself.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Persian;

public static class PersianNeural
{
    private const string PERSO = "ء-ۿݐ-ݿ‌‍";
    private static readonly JsRe WORD = JsRegex.Compile($"[{PERSO}]+", "gu");
    // Digit group FIRST so Persian-Indic digits (۰-۹, which also fall in the PERSO letter range) route to the number
    // path instead of being fed to the word/context model. Groups: 1=digits, 2=word, 3=punctuation.
    private static readonly JsRe TOKEN = JsRegex.Compile($"([\\d\\u06F0-\\u06F9]+)|([{PERSO}]+)|([۔؟،؛.?!,;:])", "gu");
    private static readonly JsRe ZWNJ = JsRegex.Compile("[‌‍]", "gu");
    // The context model was trained on ≤120-char sentences (p99≈97). Chunk longer runs to stay in-distribution.
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

    // ⚠ THE LAZY MODEL HANDLES ARE MEMOIZED PROMISES IN THE TS (`let restorerP: Promise<…> | undefined`), so the
    // model is built ONCE per process and every later call awaits the same task. Assignment is guarded by a lock
    // here because .NET can run two callers concurrently where the JS event loop cannot.
    private static readonly object GATE = new();
    private static Task<IFaVowelRestorer?>? restorerP;
    private static Task<IFaContextRestorer?>? modernCtxP;

    /**
     * Default modern Persian phonemization: structural TAGGER per clause, word-level fallback when the model is absent.
     * Async because the ONNX pass is.
     */
    public static async Task<string> PhonemizeFaNeural(string text)
    {
        text = PersianPhonemizer.NormalizePersianOrthography(text); // fold Arabic yeh/kaf → Farsi so the tagger doesn't garble
        // …then the text-normalization pass, so the tagger sees the SAME rewritten text as the sync path (a
        // clock/percentage/ordinal becomes ordinary Persian words, which is exactly what the model was trained on).
        // Everything it emits is bare orthography: the tagger's source alphabet carries no harakat (fa-tagger.meta).
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
        // Word-level resolver (the per-word fallback): lexicon-OOV words ≥3 letters → OOV seq2seq; else sync lexicon/g2p.
        async Task<string> WordLevel(string w) =>
            restorer is not null && Js.CodePoints(w).Count() >= 3 && !lex.ContainsKey(HarakatLexicon.StripHarakat(w))
                ? await restorer.Restore(w).ConfigureAwait(false)
                : PersianPhonemizer.PhonemizeWord(w);

        // PRE-PASS: resolve each Persian-word token to IPA, running the context model over each run of consecutive
        // words (a "clause") so it sees context; digits/punctuation break the run. ZWNJ is stripped so each token is
        // one model word (1:1 token↔IPA alignment). Guard: word-count mismatch or a degenerate token → per-word fallback.
        var ipaQueue = new List<string>();
        var run = new List<string>();
        async Task Flush()
        {
            if (run.Count == 0) return;
            // Route EVERY run — including 1-word — through the tagger. It labels each char, so it is reliable on
            // ISOLATED words too (دیوار→diːvaːɾ), unlike the seq2seq it replaced (which garbled 1-word input, من→mannˈan,
            // and motivated a word-level detour here). Sending isolated words to the sync g2p instead both garbled
            // uncovered words (دیوار→djuːjɾ) and made the SAME word inconsistent isolated-vs-in-clause (مدرسه madɾase vs
            // madɾese). wordLevel now remains only the model-absent fallback (phonemizeFaWordLevel) + degeneration guard.
            var @out = await ctx.Restore(string.Join(" ", run)).ConfigureAwait(false);
            var ow = @out.Split(" ");
            // The tagger emits one tag per char and only the input's space chars start a new word, so the output aligns
            // 1:1 with the input words by construction — this branch always holds. The word-COUNT fallback is retained
            // as cheap defence (e.g. if a future model file broke that invariant) but does not fire for the tagger.
            if (ow.Length == run.Count) ipaQueue.AddRange(ow);
            else foreach (var w in run) ipaQueue.Add(await WordLevel(w).ConfigureAwait(false));
            run = new List<string>();
        }
        foreach (var m in JsRegex.MatchAll(TOKEN, text))
        {
            if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                var w = JsRegex.Replace(m.Groups[2].Value, ZWNJ, _ => "");
                // LENGTH-CAP CHUNKER: the model was trained on sentence-length units (≤120 chars, p99≈97); a longer run
                // is out-of-distribution and degenerates. So before a run would exceed MAX_CLAUSE_CHARS, flush it and
                // start a fresh chunk at this word boundary. Alignment is preserved (each word still yields one IPA);
                // only cross-chunk context is lost, which is unavoidable for input longer than the model can hold.
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
        // Host pushed around the assembly: every await above has settled, so this is one synchronous turn (which is
        // what core/foreign.ts's stack requires), and without it an embedded foreign run has no host and is dropped.
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

    /**
     * The pre-context word-at-a-time path (lexicon → OOV seq2seq → g2p, NO cross-word context). Kept as the fallback
     * for when the context model is unavailable, and as the guard target for degenerate context decodes.
     */
    private static async Task<string> PhonemizeFaWordLevel(string text, IFaVowelRestorer? restorer)
    {
        if (restorer is null) return Registry.RenderInHost("fa", text); // no model at all → sync lexicon+default path
        var lex = PersianPhonemizer.HarakatLex();
        var neural = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var m in JsRegex.MatchAll(WORD, text))
        {
            var w = m.Value;
            // The seq2seq is unreliable on 1–2 letter function words (و، به، او), which the lexicon/g2p handles anyway.
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
    /** The clean-sentence filter shared by the two single-sentence context APIs below: keep only Perso-Arabic
     *  letters, the two Persian-specific vowel marks and the space, then collapse the runs. */
    private static readonly JsRe NON_PERSO = JsRegex.Compile("[^ء-ۿٰ-ۓ ]", "gu");
    private static readonly JsRe SPACE_RUN = JsRegex.Compile("\\s+", "gu");
    private static string CleanSentence(string sentence) =>
        JsRegex.Replace(
            JsRegex.Replace(PersianPhonemizer.NormalizePersianOrthography(sentence), NON_PERSO, _ => " "),
            SPACE_RUN, _ => " ").Trim();

    /**
     * OPTIONAL: phonemize a CLASSICAL Persian hemistich/sentence via the sentence-level CONTEXT model — it resolves
     * ezafe / homographs / connectors from context (+18.8pp in-domain). ⚠ Classical-scoped: excellent on
     * Shahnameh-style verse, but it can hallucinate on short/modern out-of-domain text, so this is NOT the default —
     * use `phonemizeFaNeural` for general/modern text. Falls back to the sync path when the model is unavailable.
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
     * MODERN single-sentence context API — the structural tagger (canonical IPA, 93.6% on the canonical held-out)
     * applied to one clean sentence, no digit/punctuation handling. `phonemizeFaNeural` is the full DEFAULT path (this
     * model, per clause, with digits/punctuation); use this when you have a single already-clean sentence.
     *
     * No degeneration guard: the tagger emits one tag per char, so output word-count == input word-count by
     * construction and no token can run away — the malformed outputs the seq2seq needed guarding against cannot occur.
     * Falls back to the sync path when the model / onnxruntime-node is unavailable.
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

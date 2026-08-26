/**
 * Async neural entry for Hebrew (he) — the PHASE-2 path that reads UNVOCALIZED Hebrew. Consecutive bare
 * words form a CLAUSE handed whole to the nakdan (cross-word context resolves homographs); an already-pointed
 * word goes to the rule g2p. With no model this returns exactly the sync (vocalized-only) path — no throw.
 * Ported from src/languages/hebrew/hebrewNeural.ts — see that file for every branch's measured evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hebrew;

public static class HebrewNeural
{
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    // ⚠ KEPT IDENTICAL TO Hebrew.cs's TOKEN, including the word-MEDIAL geresh — see the note there.
    private static readonly JsRe TOKEN =
        JsRegex.Compile("([א-ת][֑-ׇ־'׳’]*(?:[א-ת][֑-ׇ'׳’]*)*)|(\\d+(?:\\.\\d+)?)|([.!?…,;:׃])", "gu");
    private static readonly JsRe NIQQUD = JsRegex.Compile("\\p{Mn}", "u");
    /** The one-letter proclitics that attach across a maqaf. */
    private static readonly JsRe PRO_DASH = JsRegex.Compile("^[בכלמוה]$", "u");
    private const int MAX_CHARS = 200; // keep clauses in-distribution (the tagger trained on ≤220-char runs)

    // ⚠ The TS memoizes ONE lazy promise per process; the lock is what .NET needs and the JS event loop does not.
    private static readonly object Gate = new();
    private static Task<IHebrewTagger?>? taggerP;

    /** Phonemize Hebrew text, restoring the vowels of UNVOCALIZED words with the sentence-level nakdan. */
    public static async Task<string> PhonemizeHebrewNeural(string input)
    {
        var text = Normalize.NormalizeHebrew(input);
        Task<IHebrewTagger?> pending;
        lock (Gate) pending = taggerP ??= HebrewTagger.CreateHebrewTagger();
        var tagger = await pending.ConfigureAwait(false);
        if (tagger is null) return Sync(text); // no model → sync rule-engine path

        var queue = new List<string>();
        var run = new List<string>();

        /** The rule engine, through the lexicon layer the tagger's own tail applies. */
        string Bare(string w) => Lexicon.LexiconLookup(w) ?? HebrewPhonemizer.PhonemizeWord(w);

        // ⚠ THE ONLY FAILURE SIGNAL IS A WORD-COUNT MISMATCH, never an empty entry — and the decline is tested
        // BEFORE the count, because "" is the decline signal and "".split(" ") has length 1. The standalone
        // one-letter proclitic patch lives HERE rather than at the four call sites.
        async Task<List<string>?> Restore(List<string> ws)
        {
            if (!ws.All(tagger.CanRead)) return null;
            var outp = (await tagger.Restore(string.Join(" ", ws)).ConfigureAwait(false)).Split(' ').ToList();
            if (outp.Count != ws.Count) return null;
            if (ws.Count > 1 && outp.Where((o, i) => o == "" && PRO_DASH.IsMatch(ws[i])).Any())
            {
                var patched = new List<string>(outp.Count);
                for (var i = 0; i < outp.Count; i++)
                {
                    if (outp[i] == "" && PRO_DASH.IsMatch(ws[i]))
                    {
                        var one = Js.Trim(await tagger.Restore(ws[i]).ConfigureAwait(false));
                        patched.Add(one.Length > 0 ? one : outp[i]);
                    }
                    else patched.Add(outp[i]);
                }
                return patched;
            }
            return outp;
        }

        /** One restore of a single word, falling back to the rule engine on a decline or an empty reading. */
        async Task<string> One(string w)
        {
            var one = await Restore(new List<string> { w }).ConfigureAwait(false);
            return one is not null && one[0].Length > 0 ? one[0] : Bare(w);
        }

        /** Restore one clause run into `queue`, one entry per input word. */
        async Task Flush()
        {
            if (run.Count == 0) return;
            var words = run;
            run = new List<string>();

            var whole = await Restore(words).ConfigureAwait(false);
            if (whole is not null) { queue.AddRange(whole); return; }

            // ⚠ SPLIT AT THE WORDS THE TAGGER CANNOT READ AND KEEP THE REST BATCHED; with nothing to split on,
            // still PER WORD rather than per clause — a per-word call is a different call and can succeed.
            if (words.All(tagger.CanRead))
            {
                foreach (var w in words) queue.Add(await One(w).ConfigureAwait(false));
                return;
            }
            var seg = new List<string>();
            async Task FlushSeg()
            {
                if (seg.Count == 0) return;
                var outp = await Restore(seg).ConfigureAwait(false);
                if (outp is not null) queue.AddRange(outp);
                else foreach (var w in seg) queue.Add(await One(w).ConfigureAwait(false));
                seg = new List<string>();
            }
            foreach (var w in words)
            {
                if (tagger.CanRead(w)) { seg.Add(w); continue; }
                // Hebrew punctuation inside a word (maqaf, paseq, sof pasuq, nun hafukha) is a word boundary
                // the tagger's charset lacks: split rather than declining the whole token.
                var parts = HebrewPhonemizer.WORD_PUNCT.Re.Split(w).Where(x => x.Length > 0).ToList();
                if (parts.Count > 0 && (parts.Count > 1 || parts[0] != w) && parts.All(tagger.CanRead))
                {
                    // A one-letter first part is a PROCLITIC — joined to its first host only, never across
                    // every joiner in the token; a two-word compound is split instead.
                    var proclitic = parts.Count > 1 && PRO_DASH.IsMatch(parts[0]);
                    var units = proclitic
                        ? new List<string> { parts[0] + parts[1] }.Concat(parts.Skip(2)).ToList()
                        : parts;
                    var halves = await Restore(units).ConfigureAwait(false);
                    if (halves is not null)
                    {
                        // ⚠ THE HALVES REJOIN INTO ONE QUEUE ENTRY — AssembleClauses draws exactly one entry
                        // per TOKEN match, so pushing two shifts every later word and drops the last.
                        await FlushSeg().ConfigureAwait(false);
                        var joined = string.Join(" ", halves.Where(h => h.Length > 0));
                        queue.Add(joined.Length > 0 ? joined : Bare(w));
                        continue;
                    }
                }
                if (parts.Count > 1) // a compound with one unreadable half still splits
                {
                    await FlushSeg().ConfigureAwait(false);
                    var read = new List<string>(parts.Count);
                    foreach (var x in parts)
                        read.Add(tagger.CanRead(x) ? await One(x).ConfigureAwait(false) : Bare(x));
                    var joined = string.Join(" ", read.Where(h => h.Length > 0));
                    queue.Add(joined.Length > 0 ? joined : Bare(w));
                    continue;
                }
                await FlushSeg().ConfigureAwait(false);
                queue.Add(Bare(w));
            }
            await FlushSeg().ConfigureAwait(false);
        }

        foreach (var m in JsRegex.MatchAll(TOKEN, text))
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
            {
                var w = m.Groups[1].Value;
                if (NIQQUD.IsMatch(w))
                {
                    await Flush().ConfigureAwait(false);
                    // A joiner still separates two words when they are VOCALIZED; ReadVocalized is imported
                    // from Hebrew.cs rather than reimplemented, so the two entry points cannot drift.
                    queue.Add(HebrewPhonemizer.ReadVocalized(w));
                    continue;
                }
                var curLen = run.Aggregate(0, (a, x) => a + x.Length + 1);
                if (run.Count > 0 && curLen + w.Length > MAX_CHARS) await Flush().ConfigureAwait(false);
                run.Add(w);
            }
            else await Flush().ConfigureAwait(false); // digit / punctuation ends the clause run
        }
        await Flush().ConfigureAwait(false);

        var wi = 0;
        // Every await above has settled, so this is one synchronous turn — what Core/Foreign.cs's host stack
        // requires. Without it an embedded foreign run would be dropped outright.
        return Foreign.WithHost("he", () => Clauses.AssembleClauses(text, TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
            {
                sink.Emit(wi < queue.Count ? queue[wi] : "");
                wi++;
            }
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0) sink.Emit(Numbers.NumberToIpa(m.Groups[2].Value));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk)) sink.Pause(mk);
            }
        }));
    }

    /** The sync rule-engine path (vocalized-only) — the model-absent fallback. */
    private static string Sync(string text) =>
        Foreign.WithHost("he", () => Clauses.AssembleClauses(text, TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(HebrewPhonemizer.ReadVocalized(m.Groups[1].Value));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0) sink.Emit(Numbers.NumberToIpa(m.Groups[2].Value));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk)) sink.Pause(mk);
            }
        }));
}

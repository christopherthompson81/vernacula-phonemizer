/**
 * Async neural entry for Hebrew (he) — the PHASE-2 path that reads everyday UNVOCALIZED Hebrew. It groups
 * consecutive bare words into CLAUSES and hands each whole clause to the neural nakdan (hebrewTagger.ts), so the
 * bidirectional pass sees CROSS-WORD context and can resolve homographs (ספר = sefer/safar/siper). A word that
 * already carries niqqud is phonemized DETERMINISTICALLY by the rule g2p instead (and would break the tagger's
 * skeleton run). Numbers/punctuation are the sync engine's; clause assembly follows the sync engine's convention.
 *
 * When `onnxruntime-node` or the model is absent the tagger is `undefined` and this returns exactly the sync
 * (rule-engine, vocalized-only) path — no throw. Separate async path; the sync engine and its tests are untouched.
 * See src/languages/hebrew/he-tagger.PROVENANCE.md.
 */
import { assembleClauses } from "../../core/clauses.ts";
import { withHost } from "../../core/foreign.ts";
import { phonemizeWord } from "./hebrew.ts";
import { lexiconLookup } from "./lexicon.ts";
import { normalizeHebrew } from "./normalize.ts";
import { createHebrewTagger, type HebrewTagger } from "./hebrewTagger.ts";
import { MANIFEST } from "./manifest.ts";
import { numberToIpa } from "./numbers.ts";

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// ⚠ KEPT IDENTICAL TO `hebrew.ts`'s TOKEN, including the word-MEDIAL geresh — see the note there. This class
// used to admit the apostrophe only after the first letter, so `בייג'ינג` split where `ג'יימס` did not.
const TOKEN = /([א-ת][֑-ׇ־'׳’]*(?:[א-ת][֑-ׇ'׳’]*)*)|(\d+(?:\.\d+)?)|([.!?…,;:׃])/gu;
// ⚠ U+05BE MAQAF IS EXCLUDED, and it is inside the [֑-ׇ] block. TOKEN admits the maqaf inside a word, so
// with it in this class a bare maqaf-joined compound tested as "already vocalized": it went straight to the
// rule engine as a skeleton AND flushed the clause run around it — `בית־ספר גדול` → *vjtsfʁ ɡadol* where the
// tagger reads *bet sefeʁ ɡadol*. That is the same "one word costs its vowels" shape this module now guards
// against everywhere else. A maqaf word is bare, so it belongs on the tagger path like any other.
const NIQQUD = /[\u0591-\u05BD\u05BF-\u05C7]/u; // U+0591–U+05C7 minus U+05BE, written as escapes on purpose
const MAX_CHARS = 200; // keep clauses in-distribution (the tagger trained on ≤220-char runs)

let taggerP: Promise<HebrewTagger | undefined> | undefined;

/** Phonemize Hebrew text, restoring the vowels of UNVOCALIZED words with the sentence-level neural nakdan. */
export async function phonemizeHebrewNeural(input: string): Promise<string> {
    // Same pre-tokenizer pass as the sync engine (normalize.ts), applied ONCE so the two TOKEN sweeps below
    // see the same string. It matters more here than on the sync path: the tagger is handed WORDS, so an
    // acronym left as `ד"ר` reaches it as two one-letter fragments it can only guess at.
    const text = normalizeHebrew(input);
    if (taggerP === undefined) taggerP = createHebrewTagger();
    const tagger = await taggerP;
    if (!tagger) return sync(text); // no model → sync rule-engine path

    // PRE-PASS: resolve each Hebrew word to IPA in order. Consecutive BARE words form a clause run → the tagger
    // (context); a vocalized word or a digit/punctuation break flushes the run; vocalized words → the rule engine, inline.
    const queue: string[] = [];
    let run: string[] = [];
    const flush = async (): Promise<void> => {
        if (!run.length) return;
        const out = (await tagger.restore(run.join(" "))).split(" ");
        if (out.length === run.length && out.every(Boolean)) { queue.push(...out); run = []; return; }
        {
            // ⚠ RETRY WORD BY WORD RATHER THAN ABANDONING THE CLAUSE. The guard used to send the WHOLE run
            // to the rule engine, which on unvocalized input is a bare consonant skeleton — so one
            // unreadable word cost every vowel in the sentence. It is not a rare shape: the tagger returns
            // an EMPTY STRING for any word carrying a geresh or gershayim (צ׳מברס, ג׳ון, ח׳ופו, ד״ר), the
            // marks Hebrew uses to write foreign consonants, and those are everywhere in transliterated
            // names. Measured over the he_il corpus: 7.6% of clause runs tripped this, 6.6% of all rows
            // came out as skeletons, and their median distance against the recognized phones was 0.649
            // where the vocalized rows sat at 0.342.
            // ⚠ NOT A CHARACTER-NORMALISATION PROBLEM — the model fails on the ASCII apostrophe AND on
            // U+05F3/U+05F4 alike, and reads the same word fine with the mark removed. Its charset has no
            // geresh; only retraining fixes the word itself. What is fixable here is the blast radius.
            // ⚠ The per-word pass loses the cross-word context that is the reason clauses are batched at
            // all, so a recovered word may be vocalized less well than a clean clause pass would manage.
            // That is still the better of the two outcomes: one degraded word against a whole degraded
            // sentence.
            // ⚠ SPLIT AT THE UNREADABLE WORDS AND RE-RUN THE SEGMENTS AS CLAUSES, rather than dropping to
            // word-at-a-time for the whole run. Cross-word context is the entire reason clauses are batched
            // — it is what resolves the homographs the module doc names (ספר sefeʁ/sifeʁ, קרא kaʁa/koʁa) —
            // and a word-by-word retry throws it away for every word, not just the broken one. `canRead`
            // answers which words those are with NO model call, so this costs two or three inferences
            // instead of N+1 and keeps `הוא קרא ספר של` batched around the name that broke it.
            let seg: string[] = [];
            const flushSeg = async (): Promise<void> => {
                if (!seg.length) return;
                const o = (await tagger.restore(seg.join(" "))).split(" ");
                if (o.length === seg.length && o.every(Boolean)) queue.push(...o);
                else for (const w of seg) queue.push(lexiconLookup(w) ?? phonemizeWord(w));
                seg = [];
            };
            for (const w of run) {
                if (tagger.canRead(w)) { seg.push(w); continue; }
                // ⚠ A MAQAF IS A WORD JOINER, so split on it rather than declining the compound. U+05BE is
                // not in the tagger's charset, but each half is: `בית־ספר` → `bet sefeʁ`, where declining
                // gives the skeleton *vjtsfʁ*. Splitting also keeps the halves inside the segment, so they
                // still get the cross-word context of the clause around them. 28 he_il rows carry one.
                await flushSeg();
                // ⚠ A MAQAF IS A WORD JOINER, so split on it rather than declining the compound. U+05BE is
                // not in the tagger's charset but each half is: `בית־ספר` → `bet sefeʁ`, where declining
                // gives the skeleton *vjtsfʁ*. 28 he_il rows carry one.
                // ⚠ AND THE HALVES REJOIN INTO ONE QUEUE ENTRY. `assembleClauses` below draws exactly one
                // entry per TOKEN match, so pushing two for one input word shifts every later word and
                // silently drops the last one — which is the very failure the length guard above exists to
                // catch, reintroduced one branch down.
                const parts = w.split("\u05BE");
                if (parts.length > 1 && parts.every((x) => x && tagger.canRead(x))) {
                    const joined = (await tagger.restore(parts.join(" "))).trim();
                    queue.push(joined || (lexiconLookup(w) ?? phonemizeWord(w)));
                    continue;
                }
                // ⚠ THROUGH THE LEXICON FIRST, as the tagger's own tail does. Reaching straight for
                // `phonemizeWord` skips the layer that gives a known skeleton its curated reading.
                queue.push(lexiconLookup(w) ?? phonemizeWord(w));
            }
            await flushSeg();
        }
        run = [];
    };
    for (const m of text.matchAll(TOKEN)) {
        if (m[1]) {
            const w = m[1];
            if (NIQQUD.test(w)) { await flush(); queue.push(phonemizeWord(w)); continue; } // already vocalized → the rule engine reads it directly
            const curLen = run.reduce((a, x) => a + x.length + 1, 0);
            if (run.length && curLen + w.length > MAX_CHARS) await flush(); // length-cap chunker at a word boundary
            run.push(w);
        } else { await flush(); } // digit / punctuation ends the clause run
    }
    await flush();

    let wi = 0;
    // `withHost` — every await above has already settled, so this is one synchronous turn, which is what
    // core/foreign.ts's host stack requires. This path builds no registry engine, so nothing else pushes the
    // host and an embedded foreign run would be dropped outright.
    return withHost("he", () => assembleClauses(text, TOKEN, (m, sink) => {
        if (m[1]) sink.emit(queue[wi++] ?? "");
        else if (m[2]) sink.emit(numberToIpa(m[2]));
        else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk) sink.pause(mk); }
    }));
}

/** The sync rule-engine path (vocalized-only) — the model-absent fallback. */
function sync(text: string): string {
    return withHost("he", () => assembleClauses(text, TOKEN, (m, sink) => {
        if (m[1]) sink.emit(phonemizeWord(m[1]));
        else if (m[2]) sink.emit(numberToIpa(m[2]));
        else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk) sink.pause(mk); }
    }));
}

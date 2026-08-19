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
import { normalizeHebrew } from "./normalize.ts";
import { createHebrewTagger, type HebrewTagger } from "./hebrewTagger.ts";
import { MANIFEST } from "./manifest.ts";
import { numberToIpa } from "./numbers.ts";

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// ⚠ KEPT IDENTICAL TO `hebrew.ts`'s TOKEN, including the word-MEDIAL geresh — see the note there. This class
// used to admit the apostrophe only after the first letter, so `בייג'ינג` split where `ג'יימס` did not.
const TOKEN = /([א-ת][֑-ׇ־'׳’]*(?:[א-ת][֑-ׇ'׳’]*)*)|(\d+(?:\.\d+)?)|([.!?…,;:׃])/gu;
const NIQQUD = /[֑-ׇ]/u;
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
        if (out.length === run.length && out.every(Boolean)) queue.push(...out);
        else {
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
            for (const w of run) {
                const one = (await tagger.restore(w)).trim();
                queue.push(one && !one.includes(" ") ? one : phonemizeWord(w));
            }
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

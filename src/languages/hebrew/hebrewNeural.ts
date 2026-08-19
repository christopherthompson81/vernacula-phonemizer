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
    /** Restore one clause run into `queue`, one entry per input word. */
    const flush = async (): Promise<void> => {
        if (!run.length) return;
        const words = run;
        run = [];

        // ⚠ THE ONLY FAILURE SIGNAL IS A WORD-COUNT MISMATCH, never an empty entry. Some Hebrew words
        // legitimately phonemize to nothing — `phonemizeWord("ה") === ""`, likewise `ע` — and `emit()`
        // drops an empty string harmlessly. Testing `every(Boolean)` therefore condemned a perfectly good
        // clause because of an unrelated one-letter word: `ה בית הגדול` lost `bet` to `vjt`. The
        // all-or-nothing decline shows up as a mismatch too (it returns `""` → one token), so the count
        // test alone catches everything the truthiness test was there for.
        const restore = async (ws: string[]): Promise<string[] | undefined> => {
            const out = (await tagger.restore(ws.join(" "))).split(" ");
            return out.length === ws.length ? out : undefined;
        };
        /** The rule engine, through the lexicon layer the tagger's own tail applies. */
        const bare = (w: string): string => lexiconLookup(w) ?? phonemizeWord(w);

        const whole = await restore(words);
        if (whole) { queue.push(...whole); return; }

        // ⚠ SPLIT AT THE WORDS THE TAGGER CANNOT READ AND KEEP THE REST BATCHED. Cross-word context is the
        // whole reason clauses are batched — it is what resolves the homographs the module doc names (ספר
        // sefeʁ/sifeʁ, קרא kaʁa/koʁa) — so a word-at-a-time retry would recover the vowels and lose the
        // readings. `canRead` finds those words with NO model call, so this costs two or three inferences.
        const unreadable = words.filter((w) => !tagger.canRead(w));
        if (!unreadable.length) {
            // ⚠ NOTHING TO SPLIT ON, so do NOT re-issue the identical call. The model is deterministic and
            // the clause just failed; a retry is a guaranteed-wasted inference. The mismatch here is the
            // tagger predicting a SPACE tag mid-word, which no split can repair.
            for (const w of words) queue.push(bare(w));
            return;
        }

        let seg: string[] = [];
        const flushSeg = async (): Promise<void> => {
            if (!seg.length) return;
            const out = await restore(seg);
            if (out) queue.push(...out);
            else for (const w of seg) queue.push(bare(w));
            seg = [];
        };
        for (const w of words) {
            if (tagger.canRead(w)) { seg.push(w); continue; }
            // ⚠ A MAQAF IS A WORD JOINER, so split on it rather than declining the compound. U+05BE is not
            // in the tagger's charset but each half is: `בית־ספר` → `bet sefeʁ`, where declining gives the
            // skeleton *vjtsfʁ*. 28 he_il rows carry one.
            // ⚠ THE HALVES REJOIN INTO ONE QUEUE ENTRY, because assembleClauses draws exactly one entry per
            // TOKEN match — pushing two for one input word shifts every later word and drops the last.
            // ⚠ AND THE REJOIN IS VALIDATED. Checking only that the restore is non-empty lets a half whose
            // reading is empty vanish inside the join: `ה־בית גדול` came out as *bet ɡadol*, the `ה` gone.
            const parts = w.split("\u05BE");
            if (parts.length > 1 && parts.every((x) => x && tagger.canRead(x))) {
                const halves = await restore(parts);
                if (halves) {
                    // ⚠ THE SEGMENT STILL FLUSHES HERE, and that is a known limit rather than an
                    // oversight. The compound is its own model call, so the words before and after it end
                    // up in different segments and lose context across the maqaf. Deferring would need the
                    // segment to carry a placeholder whose entry is filled in later — worth doing when a
                    // maqaf-heavy language needs it, but `על־ידי`/`בין־לאומי`/`בית־ספר` are 28 rows here
                    // and the restored compound itself is already right.
                    await flushSeg();
                    queue.push(halves.join(" "));
                    continue;
                }
            }
            await flushSeg();
            queue.push(bare(w));
        }
        await flushSeg();
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

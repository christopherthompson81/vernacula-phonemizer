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
import { normalizeHebrew, PROCLITIC } from "./normalize.ts";
import { createHebrewTagger, type HebrewTagger } from "./hebrewTagger.ts";
import { MANIFEST } from "./manifest.ts";
import { numberToIpa } from "./numbers.ts";

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// ⚠ KEPT IDENTICAL TO `hebrew.ts`'s TOKEN, including the word-MEDIAL geresh — see the note there. This class
// used to admit the apostrophe only after the first letter, so `בייג'ינג` split where `ג'יימס` did not.
const TOKEN = /([א-ת][֑-ׇ־'׳’]*(?:[א-ת][֑-ׇ'׳’]*)*)|(\d+(?:\.\d+)?)|([.!?…,;:׃])/gu;
// "Is this word already vocalized?" — i.e. does it carry niqqud, in which case the rule g2p reads it
// deterministically and the tagger would choke on the marks.
// ⚠ TESTED AS "HAS A COMBINING MARK", NOT AS A CODE-POINT RANGE. The obvious range [U+0591–U+05C7] is the
// Hebrew block's marks AND its punctuation: U+05BE MAQAF, U+05C0 PASEQ, U+05C3 SOF PASUQ and U+05C6 NUN
// HAFUKHA are all in it and none of them is niqqud. TOKEN admits them inside a word, so with the range
// test a word ending in any of the four claimed to be "already vocalized": it went to the rule engine as
// a skeleton AND flushed the clause run around it — `שלום עולם׃ מה שלומך` → *ʃalom ʔvlm ma ʃlomχa*, and
// the sof pasuq's declared clause pause never fired either. Asking for \p{Mn} says what is meant and
// cannot drift as the block gains code points.
const NIQQUD = /\p{Mn}/u;
// The Hebrew-block punctuation TOKEN admits INSIDE a word, none of which is in the tagger's charset:
// U+05BE maqaf (joiner), U+05C0 paseq, U+05C3 sof pasuq, U+05C6 nun hafukha.
const WORD_PUNCT = /[\u05BE\u05C0\u05C3\u05C6]/u;
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
        // ⚠ THE DECLINE MUST BE TESTED BEFORE THE COUNT, because `""` is the decline signal and
        // `"".split(" ")` has length 1 — so a ONE-WORD run that the tagger declines passes a count check
        // and emits an empty string, and `emit()` swallows it. The word disappears outright, which is
        // worse than the skeleton this module set out to replace: `ג'ון` → "", `ג'ון, ראש הממשלה אמר` →
        // *ʁoʃ hamemʃala ʔamaʁ* with the name simply gone. `canRead` answers it with no model call.
        const restore = async (ws: string[]): Promise<string[] | undefined> => {
            if (!ws.every((w) => tagger.canRead(w))) return undefined;
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
        // ⚠ NOTHING TO SPLIT ON — every word is readable, so the mismatch is the tagger predicting a SPACE
        // tag mid-word and no re-issue of the same clause can repair it (the model is deterministic).
        // ⚠ BUT STILL PER WORD, NOT PER CLAUSE. Sending the whole run to the rule engine is the unbounded
        // blast radius this module exists to remove, and one mispredicted tag should cost one word. A
        // per-word call is a DIFFERENT call, so unlike re-issuing the clause it can succeed. Latent today
        // — instrumented over the corpus, this branch fires zero times — which is exactly why it should
        // not be the one path left that behaves the old way.
        if (words.every((w) => tagger.canRead(w))) {
            for (const w of words) {
                const one = await restore([w]);
                queue.push(one ? one[0]! : bare(w));
            }
            return;
        }
        let seg: string[] = [];
        const flushSeg = async (): Promise<void> => {
            if (!seg.length) return;
            const out = await restore(seg);
            // ⚠ PER WORD ON MISMATCH, matching the branch above. Every word here is readable — the segment
            // was built from `canRead` — so a mismatch is a mispredicted SPACE tag, and a per-word call is
            // a different call that can still succeed. Skeletonizing the segment would leave one more path
            // where a single bad prediction costs a whole sentence.
            if (out) queue.push(...out);
            else for (const w of seg) {
                const one = await restore([w]);
                queue.push(one ? one[0]! : bare(w));
            }
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
            // ⚠ SPLIT ON HEBREW PUNCTUATION INSIDE A WORD, not on the maqaf alone. TOKEN admits four such
            // characters mid-word and the tagger's charset has none of them: U+05BE MAQAF (a word joiner),
            // U+05C0 PASEQ, U+05C3 SOF PASUQ and U+05C6 NUN HAFUKHA. Any of them made the whole token
            // undecodable — `עולם׃` came back a skeleton and flushed its clause — though the letters on
            // either side are perfectly readable.
            // ⚠ EMPTY PARTS ARE DROPPED BEFORE THE GUARD. A word-final joiner (`בית־`, the construct form
            // normalize.ts names) yields a trailing "" and used to fail `every`, sending a fully readable
            // word to the rule engine as a skeleton.
            const parts = w.split(WORD_PUNCT).filter(Boolean);
            if (parts.length && (parts.length > 1 || parts[0] !== w) && parts.every((x) => tagger.canRead(x))) {
                // ⚠ A ONE-LETTER HALF IS A PROCLITIC AND BYPASSES THE TAGGER. It reads `ה` as nothing and
                // `ב` as a bare consonant, so joining gave "bet" with the definite article gone, or
                // "v bet". normalize.ts carries the vocalized form of each — it applies the same table
                // before a digit or a Latin run — and `phonemizeWord` reads THAT deterministically:
                // ה־ → ha, ב־ → be, ל־ → le. It cannot go through `restore`, whose charset has no niqqud.
                const lead = parts.length > 1 && parts[0]!.length === 1 ? PROCLITIC[parts[0]!] : undefined;
                const rest = lead ? parts.slice(1) : parts;
                const halves = rest.length ? await restore(rest) : [];
                if (halves) {
                    // ⚠ THE SEGMENT STILL FLUSHES HERE, and that is a known limit rather than an
                    // oversight. The compound is its own model call, so the words before and after it end
                    // up in different segments and lose context across the maqaf. Deferring would need the
                    // segment to carry a placeholder whose entry is filled in later — worth doing when a
                    // maqaf-heavy language needs it, but `על־ידי`/`בין־לאומי`/`בית־ספר` are 28 rows here
                    // and the restored compound itself is already right.
                    await flushSeg();
                    // ⚠ `filter(Boolean)` — a count check cannot catch a half whose READING is empty, and
                    // joining it leaves a stray space that `emit()` passes through: `ה־בית גדול` came out
                    // as " bet ɡadol", `גדול ה־בית` as "ɡadol  bet". The prefixed particles ה־ ב־ ל־ are
                    // exactly the halves that read empty, and normalize.ts leaves them un-rewritten.
                    queue.push([lead ? phonemizeWord(lead) : "", ...halves].filter(Boolean).join(" "));
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

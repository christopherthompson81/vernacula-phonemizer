/**
 * Async neural entry for Hebrew (he) — the PHASE-2 path that reads everyday UNVOCALIZED Hebrew. It groups
 * consecutive bare words into CLAUSES and hands each whole clause to the neural nakdan (hebrewTagger.ts), so the
 * bidirectional pass sees CROSS-WORD context and can resolve homographs (ספר = sefer/safar/siper). A word that
 * already carries niqqud is phonemized DETERMINISTICALLY by the rule g2p instead (and would break the tagger's
 * skeleton run). Numbers/punctuation are the sync engine's; clause assembly follows the sync engine's convention.
 *
 * When `onnxruntime-node` or the model is absent the tagger is `undefined` and this returns exactly the sync
 * (rule-engine, vocalized-only) path — no throw. Separate async path; the sync engine and its tests are untouched.
 * See data/languages/hebrew/he-tagger.PROVENANCE.md.
 */
import { assembleClauses } from "../../core/clauses.ts";
import { withHost } from "../../core/foreign.ts";
import { phonemizeWord, readVocalized, WORD_PUNCT } from "./hebrew.ts";
import { lexiconLookup } from "./lexicon.ts";
import { normalizeHebrew } from "./normalize.ts";
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
/** The one-letter proclitics that attach across a maqaf — the same set normalize.ts measured for
 *  this position. A proclitic is not a separate phonological word; anything else across a joiner is. */
const PRO_DASH = /^[בכלמוה]$/u;
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
        // ⚠ THE PARTICLE PATCH LIVES INSIDE `restore`, NOT AT THE CALL SITES. Applying it at one call site
        // and not its sibling is how the last round's fix left `flushSeg` still deleting the article —
        // `ג'ון ה בית הגדול` → *d͡ʒvn bet haɡadol*. There are four call sites and only one instrument;
        // putting the repair where the reading is produced makes forgetting it impossible.
        const restore = async (ws: string[]): Promise<string[] | undefined> => {
            if (!ws.every((w) => tagger.canRead(w))) return undefined;
            const out = (await tagger.restore(ws.join(" "))).split(" ");
            if (out.length !== ws.length) return undefined;
            // ⚠ A STANDALONE ONE-LETTER PROCLITIC READS AS EMPTY IN CLAUSE CONTEXT AND MUST NOT BE DROPPED.
            // The tagger tags a lone `ה` BARE, the bare letter reads "", and `emit()` discards it. Alone
            // the same tagger says `ha`, so the single-word call is the repair. 95 such particles stand
            // alone in this corpus. Only the particles are patched — an empty reading is legitimate for
            // other words, and testing every entry for truthiness broke a whole clause two rounds ago.
            if (ws.length > 1 && out.some((o, i) => o === "" && PRO_DASH.test(ws[i]!))) {
                return Promise.all(out.map(async (o, i) =>
                    o === "" && PRO_DASH.test(ws[i]!)
                        ? (await tagger.restore(ws[i]!)).trim() || o
                        : o));
            }
            return out;
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
                // ⚠ AN EMPTY RESTORE IS A FAILURE HERE, unlike in a multi-word clause. `restore([w])`
                // returns [""] on a decline — length 1 against 1, so the count check passes — and also
                // when the g2p reading is genuinely empty. Either way pushing "" drops the word, so the
                // single-word case falls back rather than trusting the count.
                const one = await restore([w]);
                queue.push(one?.[0] || bare(w));
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
                queue.push(one?.[0] || bare(w)); // same single-word caveat as above
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
                // ⚠ A ONE-LETTER FIRST PART IS A PROCLITIC, AND A PROCLITIC IS NOT A SEPARATE WORD. The
                // maqaf only spells the clitic boundary, so splitting there and reading the host in
                // isolation changes BOTH vowels — the host takes its construct form and the clitic its
                // citation one. Measured against the model: `ה־בית` split gives *ha bet*, joined *habajit*;
                // `ל־ירושלים` split *le jʁuʃalajim*, joined *liʁuʃalajim*; `ב־בית` split *be bet*, joined
                // *bevet*. The joined skeleton is what the tagger reads correctly, so the joiner is simply
                // removed and the whole thing restored as one word.
                // ⚠ AND THE OPPOSITE HOLDS FOR A TWO-WORD COMPOUND, which is why the length test decides
                // rather than a table: `בית־ספר` joined is *bejitspeʁ* and split is *bet sefeʁ*;
                // `בין־לאומי` joined *benlumi*, split *ben leumi*. Join a compound and you get one
                // nonexistent word; split a proclitic and you get two wrong ones.
                // ⚠ THE PARTICLE SET IS NAMED, NOT INFERRED FROM LENGTH. `ע` is a one-letter word and NOT
                // a proclitic, so a length test joined `ע־בית` into the nonexistent *ʔaveta*.
                // normalize.ts measured this same position and uses [בכלמוה]; ⟨ה⟩ the article is included
                // and ⟨ש⟩ excluded there at ×0 attestations, which is the list adopted here.
                // ⚠ THE PROCLITIC JOINS TO ITS FIRST HOST ONLY, never across every joiner in the token.
                // `parts.join("")` fused `ל־בית־ספר` into *levetsfeʁ* — exactly the one-nonexistent-word
                // outcome the compound rule above exists to avoid. The clitic binds to the word beside it;
                // the compound boundary after it is still a word boundary.
                const proclitic = parts.length > 1 && PRO_DASH.test(parts[0]!);
                const units = proclitic ? [parts[0]! + parts[1]!, ...parts.slice(2)] : parts;
                const halves = await restore(units);
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
                    // ⚠ AND THE REJOIN FALLS BACK LIKE EVERY OTHER CALL SITE. A single-unit restore returns
                    // a length-1 array that passes the count check even when the reading is empty, so
                    // without this the whole token is emitted as "" and `emit()` drops it.
                    queue.push(halves.filter(Boolean).join(" ") || bare(w));
                    continue;
                }
            }
            // ⚠ A COMPOUND WITH ONE UNREADABLE HALF STILL SPLITS. Falling straight to `bare(w)` fuses it
            // into a single skeleton — `ה־ג'ון` → *hd͡ʒvn* — discarding the boundary the rest of this
            // branch exists to honour. Each half takes the best path available to it.
            if (parts.length > 1) {
                await flushSeg();
                const read = await Promise.all(parts.map(async (x) => {
                    if (!tagger.canRead(x)) return bare(x);
                    const one = await restore([x]);
                    return one?.[0] || bare(x);
                }));
                // ⚠ `|| bare(w)` as at every other call site — if every part reads empty the join is "" and
                // `emit()` drops the token. Same omission the review found one branch up; fixed in both.
                queue.push(read.filter(Boolean).join(" ") || bare(w));
                continue;
            }
            await flushSeg();
            queue.push(bare(w));
        }
        await flushSeg();
    };

    for (const m of text.matchAll(TOKEN)) {
        if (m[1]) {
            const w = m[1];
            if (NIQQUD.test(w)) {
                await flush();
                // ⚠ A JOINER STILL SEPARATES TWO WORDS WHEN THEY ARE VOCALIZED. `phonemizeWord` scans a
                // token as ONE word, so a maqaf compound fuses: `בֵּית־סֵפֶר` → *betsefeʁ*, one nonexistent
                // word where the reading is *bet sefeʁ*. The bare path already splits on WORD_PUNCT; the
                // vocalized path has to as well, or the same input is right unpointed and wrong pointed.
                // ⚠ `readVocalized` IS IMPORTED FROM hebrew.ts, not reimplemented. Both entry points must
                // agree byte for byte — this module's contract is that the model-absent path returns
                // exactly the sync path, and a test asserts it — so a second copy of the split is a drift
                // waiting to happen rather than a convenience.
                queue.push(readVocalized(w));
                continue;
            }
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
        if (m[1]) sink.emit(readVocalized(m[1]));
        else if (m[2]) sink.emit(numberToIpa(m[2]));
        else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk) sink.pause(mk); }
    }));
}

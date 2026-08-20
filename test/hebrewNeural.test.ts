import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeHebrewNeural } from "../src/languages/hebrew/hebrewNeural.ts";

// The neural VOWEL RESTORER for UNVOCALIZED Hebrew is gated on the (optional) ONNX model + onnxruntime-node.
// When absent the path falls back to the sync rule engine (vocalized-only), so the fallback contract is testable
// everywhere; the restoration assertions run only with the model present. See he-tagger.PROVENANCE.md.
const haveModel = existsSync(join(import.meta.dirname, "../src/languages/hebrew/he-tagger.int8.onnx"));

describe("hebrew neural vowel restoration", () => {
    // A VOCALIZED word is always routed to the deterministic rule g2p (the tagger declines on niqqud chars), so
    // vocalized text is identical to the sync path whether or not the model is present.
    test("vocalized text: neural path equals the sync rule path", async () => {
        for (const s of ["שָׁלוֹם", "מָשִׁיחַ", "אֶבֶן"]) {
            expect(await phonemizeHebrewNeural(s)).toBe(phonemize(s, "he"));
        }
    });

    describe.skipIf(!haveModel)("with the ONNX model present", () => {
        // UNVOCALIZED text: the sync engine gives only a vowel-less consonant skeleton (ʃlvm ʔvlm); the tagger
        // restores the vowels to readable Modern Israeli IPA.
        test("unvocalized text: the tagger restores vowels the sync skeleton lacks", async () => {
            const neural = await phonemizeHebrewNeural("שלום עולם");
            expect(neural).not.toBe(phonemize("שלום עולם", "he"));
            expect(neural).toBe("ʃalom ʔolam");
        });

        test("a common unvocalized phrase restores correctly", async () => {
            expect(await phonemizeHebrewNeural("אני אוהב אותך")).toBe("ʔani ʔohev ʔotχa"); // sentence context → present-tense ohev; אותך masc. "you" = otχa
        });

        /**
         * ⚠ ONE UNREADABLE WORD MUST NOT COST THE SENTENCE ITS VOWELS. The tagger returns an EMPTY STRING
         * for any word carrying a geresh or gershayim — צ׳ ג׳ ז׳ ח׳, the marks Hebrew writes foreign
         * consonants with, and ד״ר for an abbreviation — because its charset has none of them. The
         * alignment guard used to send the WHOLE clause run to the rule engine on any mismatch, and on
         * unvocalized input that is a bare consonant skeleton, so a single transliterated name flattened
         * every vowel around it.
         *
         * Measured over the he_il corpus: 7.6% of clause runs tripped it, 216 of 3,242 rows (6.6%) came out
         * as skeletons, and their median distance against the recognized phones was 0.649 against 0.342 for
         * the vocalized rows. Retrying word by word takes the skeleton rows to ZERO — 330 rows closer to
         * what the reader said, 28 further, median 0.352 → 0.341.
         *
         * ⚠ NOT FIXABLE BY NORMALISING THE MARK: the model fails on the ASCII apostrophe and on U+05F3 /
         * U+05F4 alike, and reads the same word fine with the mark removed. Only the geresh WORD degrades
         * now, and it degrades to a consonantally-correct skeleton (צ׳ is still read /t͡ʃ/ by the rules).
         */
        test("a geresh word degrades alone, not the clause around it", async () => {
            const out = await phonemizeHebrewNeural("צ'מברס תבע את אלוהים");
            expect(out).toContain("t͡ʃmvʁs");        // the geresh word: no vowels, right consonants
            expect(out).toContain("tava ʔet ʔelohim"); // and everything else is fully restored
        });

        test("a mid-sentence geresh name leaves the rest vocalized", async () => {
            const out = await phonemizeHebrewNeural("אך ראש הממשלה ג'ון האוורד אמר");
            expect(out).toContain("ʔaχ ʁoʃ hamemʃala");
            expect(out).toContain("ʔamaʁ");
        });

        /**
         * ⚠ AND THE CLAUSE KEEPS ITS CROSS-WORD CONTEXT AROUND THE BROKEN WORD. Retrying word-at-a-time
         * would recover the vowels but lose the very thing clauses are batched for — `ספר` is sefeʁ or
         * sifeʁ and `קרא` is kaʁa or koʁa depending on the sentence, which is the module doc's own reason
         * for batching. `canRead` identifies the unreadable words with no model call, so the run is split
         * at them and the surviving segments stay batched.
         */
        test("the surviving segments keep their context, not just their vowels", async () => {
            const out = await phonemizeHebrewNeural("הוא קרא ספר של ג'ון טוב");
            expect(out).toContain("kaʁa sefeʁ"); // the clause reading; word-at-a-time gives koʁa / sifeʁ
            expect(out).toContain("d͡ʒvn");       // and only the geresh name degrades
        });

        /**
         * ⚠ THE MAQAF U+05BE IS A WORD JOINER, NOT NIQQUD, and it sits inside the [U+0591–U+05C7] block.
         * Classing it as niqqud made a bare compound test as "already vocalized": it went to the rule
         * engine as a skeleton AND flushed the clause around it. It is not in the tagger's charset either,
         * so the compound is split on it and the halves restored together.
         *
         * ⚠ THE HALVES REJOIN INTO ONE QUEUE ENTRY. assembleClauses draws exactly one entry per token, so
         * pushing two for one input word shifts every later word and drops the last — the same alignment
         * failure the length guard exists to catch. `ɡadol` is the canary.
         */
        /**
         * ⚠ AN EMPTY READING IS NOT A FAILURE SIGNAL. Some Hebrew words legitimately phonemize to nothing
         * — `phonemizeWord("ה") === ""`, likewise `ע` — and `emit()` drops an empty string harmlessly. A
         * truthiness check on the tagger's output therefore condemned a perfectly good clause because of
         * an unrelated one-letter word, sending it to the rule engine as a skeleton: `ה בית הגדול` lost
         * `bet` to `vjt`. The word-COUNT mismatch is the only failure signal, and it catches the
         * all-or-nothing decline too (that returns "" → one token against N).
         */
        test("a word whose reading is empty does not skeletonize its clause", async () => {
            // ⚠ ASSERTED WHOLE, NOT `toContain`. The loose form passed while the article was being DROPPED
            //   — `bet haɡadol` contains the substring either way — so the assertion could not see the
            //   defect it sat next to.
            // ⚠ AND A STANDALONE ONE-LETTER PROCLITIC IS NOT DROPPED. The tagger tags a lone `ה` BARE and
            //   the bare letter reads as "", which `emit()` discards; alone the same tagger says `ha`. 95
            //   such particles stand alone in this corpus, so it is attested rather than hypothetical.
            // ⚠ `bajit`, NOT `bet` — UPDATED 2026-08-19 and the change is a FIX, not drift. בית is
            //   state-ambiguous: absolute בַּיִת *bajit* "a house" vs construct בֵּית *bet* "house-of". With the
            //   definite article this is הבית הגדול = *ha-bajit ha-gadol*, the absolute; the pre-packing model
            //   said *bet* in EVERY context, i.e. it had the construct right and the absolute wrong. The
            //   retrained tagger now splits them by context — בית־ספר and בית ספר still read *bet sefeʁ* below
            //   — which is precisely the homograph resolution a SENTENCE-level nakdan exists to do.
            expect(await phonemizeHebrewNeural("ה בית הגדול")).toBe("ha bajit haɡadol");
            // ⚠ AND ON THE SEGMENT PATH TOO. The patch was applied at the whole-clause call site only, so a
            //   clause that ALSO held an unreadable word took the other branch and dropped the article.
            //   It lives inside `restore` now, where no call site can omit it.
            expect(await phonemizeHebrewNeural("ג'ון ה בית הגדול")).toBe("d͡ʒvn ha bajit haɡadol");
            expect(await phonemizeHebrewNeural("בית־ספר ה גדול")).toBe("bet sefeʁ ha ɡadol");
        });

        /** ⚠ And the rejoined maqaf halves are VALIDATED, or a half whose reading is empty vanishes inside
         *  the join — `ה־בית גדול` came out as *bet ɡadol* with the `ה` gone. */
        test("a maqaf half with an empty reading is not swallowed", async () => {
            expect(await phonemizeHebrewNeural("ע־בית גדול")).toBe("ʔa bet ɡadol");
            // ⚠ AND A HALF WHOSE READING IS GENUINELY EMPTY LEAVES NO GAP. `ה־` `ב־` `ל־` are the
            //   prefixed particles, they phonemize to nothing, and normalize.ts leaves them attached — so
            //   joining the halves unfiltered emitted a stray space that `emit()` passed straight through.
            // ⚠ AND A ONE-LETTER HALF IS A PROCLITIC, VOCALIZED RATHER THAN DROPPED. The tagger reads `ה`
            //   as nothing and `ב` as a bare consonant, so filtering the empty half merely deleted the
            //   definite article. normalize.ts already carries the vocalized form of each — it applies the
            //   same table before a digit — and the rule engine reads THAT: ה־ → ha, ב־ → be, ל־ → le.
            //   It cannot go through the tagger, whose charset has no niqqud.
            // ⚠ A ONE-LETTER PROCLITIC IS NOT A SEPARATE WORD, so the joiner is REMOVED and the whole
            //   thing read as one. Splitting there changes both vowels — the host takes its construct form
            //   and the clitic its citation one: `ה־בית` split is *ha bet*, joined *habajit*; `ל־ירושלים`
            //   split *le jʁuʃalajim*, joined *liʁuʃalajim*.
            // ⚠ AND THE OPPOSITE HOLDS FOR A TWO-WORD COMPOUND, which is why the length of the first part
            //   decides rather than a particle table: `בית־ספר` joined is the nonexistent *bejitspeʁ* and
            //   split is *bet sefeʁ*; `בין־לאומי` joined *benlumi*, split *ben leumi*.
            expect(await phonemizeHebrewNeural("ה־בית גדול")).toBe("habajit ɡadol");
            expect(await phonemizeHebrewNeural("ב־בית גדול")).toBe("bevet ɡadol");
            expect(await phonemizeHebrewNeural("ל־ירושלים גדולה")).toBe("liʁuʃalajim ɡdola");
            expect(await phonemizeHebrewNeural("בית־ספר גדול")).toBe("bet sefeʁ ɡadol");
            // ⚠ A compound whose second half the tagger cannot read still SPLITS, rather than fusing into
            //   one skeleton — `ה־ג'ון` was *hd͡ʒvn*.
            expect(await phonemizeHebrewNeural("ה־ג'ון")).toBe("ha d͡ʒvn");
            // ⚠ AND THE PROCLITIC JOINS TO ITS FIRST HOST ONLY. Removing every joiner in the token fused
            //   `ל־בית־ספר` into *levetsfeʁ* — the one-nonexistent-word outcome the compound rule exists to
            //   avoid. The clitic binds to the word beside it; the compound boundary after it survives.
            expect(await phonemizeHebrewNeural("ל־בית־ספר גדול")).toBe("levet sefeʁ ɡadol");
            expect(await phonemizeHebrewNeural("ב־בית־ספר גדול")).toBe("bevet sefeʁ ɡadol");
        });

        /**
         * ⚠ A ONE-WORD RUN THE TAGGER DECLINES MUST NOT VANISH. `""` is the decline signal and
         * `"".split(" ")` has length 1, so a single-word decline passed the count check, was pushed as an
         * empty string, and `emit()` swallowed it — the word gone outright, which is worse than the
         * skeleton this module replaced. Any punctuation- or digit-bounded geresh name takes this path,
         * and those are common in the corpus.
         */
        /**
         * ⚠ THE HEBREW BLOCK'S PUNCTUATION IS NOT NIQQUD, and TOKEN admits four of them INSIDE a word:
         * U+05BE maqaf, U+05C0 paseq, U+05C3 sof pasuq, U+05C6 nun hafukha. None is in the tagger's
         * charset, so any of them made the whole token undecodable — `עולם׃` came back a skeleton and
         * flushed the clause around it — although the letters either side are perfectly readable. A
         * word-final joiner (`בית־`, the construct form) is the same shape and used to fail the guard on
         * its empty trailing part.
         */
        test("word-internal Hebrew punctuation splits rather than skeletonizing", async () => {
            // ⚠ AND THE SOF PASUQ EMITS ITS DECLARED CLAUSE PAUSE. `׃` is in `clausePunctuation` (→ "."),
            //   but the word tokenizer swallowed it — it is inside the mark class the token pattern uses —
            //   so the punctuation alternative never saw it and the pause was silently dropped. The
            //   normalizer separates it now, which is what lets the existing rule fire.
            expect(await phonemizeHebrewNeural("שלום עולם׃ מה שלומך")).toBe("ʃalom ʔolam . ma ʃlomχa");
            expect(await phonemizeHebrewNeural("שלום עולם׃ מה שלומך"))
                .toBe(await phonemizeHebrewNeural("שלום עולם. מה שלומך"));
            expect(await phonemizeHebrewNeural("שלום׀ עולם")).toBe("ʃalom ʔolam");
            expect(await phonemizeHebrewNeural("בית־")).toBe("bet");
            // ⚠ AND A TOKEN THAT IS ONLY PUNCTUATION LEAVES NOTHING TO SPLIT. `filter(Boolean)` empties
            //   the parts array, so the guard must short-circuit before indexing it.
            expect(await phonemizeHebrewNeural("־")).toBe("");
            expect(await phonemizeHebrewNeural("שלום ־ עולם")).toBe("ʃalom ʔolam");
            // ⚠ AND A VOCALIZED COMPOUND SPLITS TOO, or the same input is right unpointed and wrong
            //   pointed. A pointed word skips the tagger and goes straight to `phonemizeWord`, which scans
            //   a token as ONE word — so the joiner fused two into a nonexistent one: *betsefeʁ*.
            expect(await phonemizeHebrewNeural("בֵּית־סֵפֶר גָּדוֹל")).toBe("bet sefeʁ ɡadol");
        });

        test("a declined single-word run falls back, it does not disappear", async () => {
            expect(await phonemizeHebrewNeural("ג'ון")).toBe("d͡ʒvn");
            expect(await phonemizeHebrewNeural("ג'ון, ראש הממשלה אמר")).toContain("d͡ʒvn");
            expect(await phonemizeHebrewNeural("ג'ון 5")).toContain("d͡ʒvn");
        });

        test("a maqaf compound restores, and does not shift the words after it", async () => {
            expect(await phonemizeHebrewNeural("בית־ספר גדול")).toBe("bet sefeʁ ɡadol");
            expect(await phonemizeHebrewNeural("בית־ספר ותיק מאוד")).toBe("bet sefeʁ vatik meod");
        });

        /**
         * ⚠ THE INVARIANT BEHIND ALL OF THE ABOVE, asserted directly rather than through examples: every
         * branch of `flush` pushes EXACTLY ONE queue entry per input word. `assembleClauses` draws one
         * entry per TOKEN match, so a branch that pushes two shifts every later word and silently drops
         * the last — the failure that ate `ɡadol` when the maqaf halves were pushed separately. Nothing in
         * the output shape reveals it; only the missing tail does.
         *
         * Each case below routes through a different branch: clean clause, geresh split, maqaf rejoin,
         * empty-reading word, and an unsplittable failure.
         */
        test("every branch emits one entry per input word", async () => {
            // ⚠ THE CASES MUST COMBINE BRANCHES, NOT JUST VISIT THEM ONE AT A TIME. Every branch was
            //   covered individually and the particle patch was still missing from `flushSeg` — it takes a
            //   clause holding BOTH an unreadable word and a standalone particle to route through the
            //   segment path with something to patch. `ג'ון ה בית הגדול` is that case, and it emitted 3
            //   words for 4 inputs until the patch moved inside `restore`.
            const cases = [
                "הוא קרא ספר של דוד",          // clean clause
                "הוא קרא ספר של ג'ון טוב",     // geresh → segment split
                "הוא קרא בית־ספר של דוד",      // maqaf → rejoin
                "ה בית הגדול",                 // a word whose reading is empty
                "צ'מברס תבע את אלוהים בגין",   // leading unreadable word
                "ג'ון ה בית הגדול",            // unreadable word AND a particle → the segment path
                "בית־ספר ה גדול",              // maqaf rejoin AND a particle
                "ל־בית־ספר גדול",              // a proclitic ON a compound
            ];
            for (const c of cases) {
                const out = await phonemizeHebrewNeural(c);
                // ⚠ NO `.trim()` AND NO `filter(Boolean)` HERE. An earlier version of this test normalised
                //   the whitespace away and thereby hid two live defects — a dropped word and a stray
                //   double space from joining an empty maqaf half. A test that launders its input cannot
                //   see the class of bug it was written for.
                expect(out, `leading/trailing space for: ${c}`).toBe(out.trim());
                expect(out, `doubled space for: ${c}`).not.toMatch(/\s\s/u);
                // ⚠ NO SLACK. An earlier `- 1` tolerance was exactly wide enough to hide a dropped word,
                //   which is the defect this test exists to catch. Every case below emits one IPA word per
                //   input word; the maqaf compound emits two for its one token, hence `>=`.
                expect(out.split(" ").length,
                    `word count collapsed for: ${c}`).toBeGreaterThanOrEqual(c.split(" ").length);
            }
        });
    });
});

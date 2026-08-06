/**
 * The dependency-free Khmer boundary perceptron — the properties a SYNC caller can rely on.
 *
 * This model exists because the BiLSTM needs `onnxruntime-node` (optional) and so can only serve the async tier.
 * The perceptron is a Map of 42,643 weights and an addition loop, so it could serve `phonemize` itself. What is
 * asserted here is deliberately structural: the model is ~77% on exact boundary placement, so pinning individual
 * splits would pin noise. See km-segmenter.PROVENANCE.md for the three-way comparison.
 */
import { describe, expect, test } from "vitest";

import { havePerceptron, restoreBoundaries, segmentRun, ZWSP } from "../src/languages/khmer/khmerPerceptron.ts";

describe("khmer boundary perceptron", () => {
    test("the weight table loads", () => {
        expect(havePerceptron()).toBe(true);
    });

    test("⚠ segmentation is a partition — nothing lost, duplicated or reordered", () => {
        // The invariant that matters most for a model that rewrites text: joining the pieces must reproduce the
        // input exactly. A boundary in the wrong place is recoverable; deleted text is not.
        for (const s of ["ខែឧសភា", "ព្រះរាជាណាចក្រកម្ពុជា", "នៅសតវត្ស", "អារម្មណ៍នោះ", "ធំ"])
            expect(segmentRun(s).join(""), s).toBe(s);
    });

    test("restoreBoundaries only ever inserts U+200B, and only inside Khmer runs", () => {
        for (const s of ["hello world", "123", "", "abc 456"]) expect(restoreBoundaries(s)).toBe(s);
        const out = restoreBoundaries("ថ្ងៃទី១៥ ខែមករា");
        expect(out.split(ZWSP).join("")).toBe("ថ្ងៃទី១៥ ខែមករា"); // text preserved
        expect(out).toContain(ZWSP);                               // and it did something
    });

    test("a single short word is not split", () => {
        for (const s of ["ធំ", "ថ្មី"]) expect(segmentRun(s)).toEqual([s]);
    });

    test("the month compound the unigram segmenter cannot split IS split here", () => {
        // ខែមករា is in km-wordfreq.tsv 505 times, so unigram Viterbi keeps it whole (0 of 12 recovered). A
        // discriminative model has no such bias — it scores the boundary, not the word.
        expect(segmentRun("ខែមករា").length).toBeGreaterThan(1);
    });

    test("⚠ the feature WIRE FORMAT still matches the trainer's", () => {
        // The feature strings ("a"+char, "g"+bigram, "k"+trigram, "^" for padding) are a contract between
        // tools/khmer/train_km_perceptron.py's `feats()` and khmerPerceptron.ts's `score()`. Nothing in the type
        // system couples them: rename a prefix on one side and every affected weight silently stops being found —
        // no error, just a quietly worse model. Cross-checked identical at generation time (Python and TS produced
        // byte-identical score vectors), and these expectations were emitted BY THE PYTHON TRAINER so that a drift
        // on either side breaks this test.
        const FROM_TRAINER: readonly [string, readonly string[]][] = [
        ["ខែមករា", ["ខែ", "មករា"]],
        ["នៅសតវត្ស", ["នៅសតវត្ស"]],
        ["ព្រះរាជាណាចក្រកម្ពុជា", ["ព្រះ", "រាជាណាចក្រ", "កម្ពុជា"]],
        ["អារម្មណ៍នោះ", ["អារម្មណ៍", "នោះ"]],
        ];
        for (const [run, want] of FROM_TRAINER) expect(segmentRun(run), run).toEqual(want);
    });

    test("it is deterministic — the same run always segments the same way", () => {
        const a = segmentRun("ព្រះរាជាណាចក្រកម្ពុជា");
        expect(segmentRun("ព្រះរាជាណាចក្រកម្ពុជា")).toEqual(a);
    });
});

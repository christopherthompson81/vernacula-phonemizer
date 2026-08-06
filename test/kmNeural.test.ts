import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeKmNeural } from "../src/languages/khmer/khmerNeural.ts";
import { ZWSP } from "../src/languages/khmer/khmerSegmenter.ts";

// The word-boundary restorer is gated on the (optional) ONNX model + onnxruntime-node. Absent either, the path IS
// the sync engine, so the fallback contract is testable everywhere and the restoration assertions run only with the
// model present. See km-segmenter.PROVENANCE.md and docs/investigations/km_word_segmentation_investigation.md.
const haveModel = existsSync(join(import.meta.dirname, "../src/languages/khmer/km-segmenter.int8.onnx"));

describe("khmer neural word-boundary restoration", () => {
    test("text with no Khmer run is byte-identical to the sync path", async () => {
        // The fallback contract: this path may only ever ADD boundaries inside Khmer runs.
        for (const s of ["123", "%", "abc"]) expect(await phonemizeKmNeural(s)).toBe(phonemize(s, "km"));
    });

    test("a single-word run is unchanged — nothing to segment", async () => {
        // ធំ and ថ្មី are the corpus's commonest ៗ antecedents and are single vocabulary words; splitting either
        // would be a regression visible in ordinary text.
        for (const s of ["ធំ", "ថ្មី"]) expect(await phonemizeKmNeural(s)).toBe(phonemize(s, "km"));
    });

    describe.skipIf(!haveModel)("with the ONNX model present", () => {
        test("⚠ ខែ + month name reads as two words", async () => {
            // The defect that motivated the model. Joined, the syllabifier steals the month's initial consonant as a
            // coda of ខែ and a whole syllable disappears: ខែឧសភា → kʰaehpʰiə, ខែកុម្ភៈ → kʰaekom (truncated).
            // 9 of the 12 month names degrade this way; each is fixed by restoring the boundary.
            // ⚠ THE SYNC PATH NOW FIXES THIS TOO, since the perceptron ships there — this assertion used to pin
            // `kʰaehpʰiə` as the sync DEFECT. Both tiers restore the boundary now; the async one is simply better
            // at placing it (referee agreement 47.8% against 46.2%, and 80.4% vs 76.7% on corpus junctions).
            expect(phonemize("ខែឧសភា", "km")).toBe("kʰae ʔosɑpʰiə");
            expect(await phonemizeKmNeural("ខែឧសភា")).toBe("kʰae ʔosɑpʰiə"); // ខែ + the month's isolated reading
            expect(await phonemizeKmNeural("ខែកុម្ភៈ")).toBe("kʰae kompʰeəʔ");
        });

        test("a boundary the unigram segmenter provably cannot find", async () => {
            // `segment.ts` recovers 0 of 12 month compounds because ខែមករា is itself in its frequency table 505
            // times, and splitting always costs an extra −log(p). Frequency cannot fix a frequency problem.
            expect(await phonemizeKmNeural("ខែមករា")).toContain("meəkɑraː");
        });

        test("ordinary prose junctions are restored", async () => {
            // នៅ|សតវត្ស ("in the century") — joined it reads nɨwhtɑʋɑt, the ស collapsed into a coda.
            expect(await phonemizeKmNeural("នៅសតវត្ស")).toBe("nɨw sɑtɑʋoət");
        });

        test("⚠ the segmenter never loses or invents characters", async () => {
            // Output length == input length by construction (one label per character), so the worst failure mode is
            // a MISPLACED boundary rather than lost text. This pins that property through the public path.
            const { createKhmerSegmenter } = await import("../src/languages/khmer/khmerSegmenter.ts");
            const seg = await createKhmerSegmenter();
            expect(seg).toBeDefined();
            for (const s of ["ខែឧសភា", "ព្រះរាជាណាចក្រកម្ពុជា", "នៅសតវត្សទី២០", "ធំ"]) {
                const out = await seg!.restore(s);
                expect(out.split(ZWSP).join("")).toBe(s);
            }
        });

        test("non-Khmer text passes through the restorer untouched", async () => {
            const { createKhmerSegmenter } = await import("../src/languages/khmer/khmerSegmenter.ts");
            const seg = await createKhmerSegmenter();
            for (const s of ["hello world", "123 456", ""]) expect(await seg!.restore(s)).toBe(s);
        });
    });
});

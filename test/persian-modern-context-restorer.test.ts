import { describe, expect, test } from "vitest";

import { createFaTagger } from "../src/languages/persian/faTagger.ts";
import { phonemizeFaModernContext } from "../src/faNeural.ts";

// The MODERN Persian sentence-level restorer is the STRUCTURAL TAGGER (faTagger.ts, int8 ONNX, HomoRich-trained,
// 93.6% on the canonical held-out). It emits one IPA-chunk tag per abjad char, so output length == input length:
// it cannot degenerate and word counts always align. Optional at runtime: if onnxruntime-node or the model is
// absent, the factory is undefined and these skip. See fa-tagger.PROVENANCE.md.
describe("Persian MODERN restorer — structural tagger (homograph/ezafe from context on modern text)", async () => {
    const restorer = await createFaTagger();

    test.skipIf(!restorer)("resolves رو + ezafe -ye from context", async () => {
        // روی here is ru + ezafe -ye (ɾuːje), which only sentence context fixes — a word-level model cannot see it.
        const out = await phonemizeFaModernContext("مرد از خستگی روی زمین افتاد");
        expect(out).toContain("ɾuːjˈe");
    });

    test.skipIf(!restorer)("output word-count equals input by construction (no degeneration possible)", async () => {
        // The tagger tags each char; only the input's spaces start a new word, so the counts must match exactly and
        // no token can run away — the structural guarantee that retired the seq2seq's degeneration guard.
        const sentence = "کودک با مادرش به مدرسه رفت";
        const out = await phonemizeFaModernContext(sentence);
        expect(out.split(" ").length).toBe(sentence.split(" ").length);
        expect(out.split(" ").every((w) => [...w].length <= 12)).toBe(true); // no runaway token
        expect(out.split(" ").at(-1)).toContain("aft"); // clean رفت
    });
});

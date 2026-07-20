import { describe, expect, test } from "vitest";

import { createFaModernContextRestorer } from "../src/languages/persian/contextRestorer.ts";
import { phonemizeFaModernContext } from "../src/faNeural.ts";

// The MODERN Persian context restorer (sentence-level seq2seq, int8 ONNX, HomoRich-trained, 85.6% held-out
// per-word). Optional at runtime: if onnxruntime-node or the model is absent, the factory is undefined and these
// skip. Assertions go through the GUARDED path (phonemizeFaModernContext), not the raw restore() — the guard is
// part of the contract (it catches the ~0.2% greedy-decode degeneration). See fa-context-modern.PROVENANCE.md.
describe("Persian MODERN context restorer (homograph/ezafe from context on modern text)", async () => {
    const restorer = await createFaModernContextRestorer();

    test.skipIf(!restorer)("resolves رو + ezafe -ye from context", async () => {
        // روی here is ru + ezafe -ye (ɾuːje), which only sentence context fixes — a word-level model cannot see it.
        const out = await phonemizeFaModernContext("مرد از خستگی روی زمین افتاد");
        expect(out).toContain("ɾuːjˈe");
    });

    test.skipIf(!restorer)("guard keeps output clean when greedy decode degenerates", async () => {
        // This sentence trips the greedy-decode degeneration on the raw model (a runaway final token). The guard
        // (word-count mismatch / repeated-bigram) must fall back so no token is a runaway string.
        const out = await phonemizeFaModernContext("کودک با مادرش به مدرسه رفت");
        expect(out.split(" ").every((w) => [...w].length <= 12)).toBe(true); // no runaway
        expect(out.split(" ").at(-1)).toContain("aft"); // clean رفت
    });
});

import { describe, expect, test } from "vitest";

import { phonemize, phonemizeAsync } from "../src/index.ts";

// phonemizeAsync — the unified best-output entry. Routes the unpointed abjads (Arabic + dialects, Hebrew) through
// their neural restorers and the neural-upgrade languages (en BiLSTM OOV, bn/da/nb/fr taggers, ur/ps/pnb riders)
// through their ONNX models; every other language resolves synchronously (identical to `phonemize`). onnxruntime-node
// is a shipped dependency, so the neural paths are exercised here.
describe("phonemizeAsync — unified async best-output entry", () => {
    test("non-neural languages pass through byte-identical to the sync phonemize", async () => {
        for (const [w, l] of [["भारत", "hi"], ["Türkçe", "tr"], ["Україна", "uk"], ["ਪੰਜਾਬੀ", "pa"], ["世界", "cmn"]] as [string, string][]) {
            expect(await phonemizeAsync(w, l)).toBe(phonemize(w, l));
        }
    });

    test("the unpointed ABJADS restore unwritten vowels from BARE input (not the sync skeleton)", async () => {
        expect(await phonemizeAsync("עברית", "he")).toBe("ʔivʁit"); // Hebrew NAKDAN; sync would give the skeleton ʔvʁjt
        expect(await phonemizeAsync("العربية", "ar")).toBe("alʕarabˈijːa"); // Arabic diacritizer
        // the async abjad output is genuinely richer than the bare-text sync skeleton
        expect(await phonemizeAsync("עברית", "he")).not.toBe(phonemize("עברית", "he"));
    });

    test("English OOV routes through the BiLSTM tagger (a genuinely out-of-dictionary word resolves)", async () => {
        const out = await phonemizeAsync("computerization", "en");
        expect(out.length).toBeGreaterThan(0);
        expect(out).toContain("kəmpj"); // the BiLSTM reading of the OOV onset
    });

    test("the Perso-Arabic RIDERS route without throwing (incl. pnb→the rider's `pa` key)", async () => {
        // Regression: pnb (Shahmukhi Punjabi) must map to the rider's Punjabi key `pa`, not the invalid "pnb".
        for (const [w, l] of [["اردو", "ur"], ["پښتو", "ps"], ["پنجابی", "pnb"]] as [string, string][]) {
            const out = await phonemizeAsync(w, l);
            expect(out.length).toBeGreaterThan(0); // resolves (does not throw)
        }
    });
});

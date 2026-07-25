import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeEnNeural } from "../src/enNeural.ts";
import { createEnglishTagger } from "../src/languages/english/englishTagger.ts";

// The neural OOV tagger is gated on the (optional) ONNX model + onnxruntime-node. When absent the path falls back to
// the sync CMUdict + n-gram engine, so the fallback contract is testable everywhere; the retagging assertions run only
// with the model present. See docs/investigations/en_referee_noise_and_neural_oov_investigation.md.
const haveModel = existsSync(join(import.meta.dirname, "../src/languages/english/en-g2p-tagger.int8.onnx"));

describe("english neural OOV tagger", () => {
    // Dict words, heteronyms, numbers, possessives, and punctuation are the SYNC engine's — the neural path only swaps
    // genuinely-OOV word readings, so on lexicon-covered text it is byte-identical to phonemize(text, "en").
    test("dict/common text: neural path is byte-identical to the sync path", async () => {
        for (const s of ["The cat sat on the mat.", "I have twenty-three apples.", "She reads books and closes it."]) {
            expect(await phonemizeEnNeural(s)).toBe(phonemize(s, "en"));
        }
    });

    describe.skipIf(!haveModel)("with the ONNX model present", () => {
        test("OOV word: the tagger fills the tail (differs from the n-gram reading)", async () => {
            // Zelensky — the n-gram mangles the initial (…aᶦzɪ…); the BiLSTM reads it cleanly.
            const s = "Zelensky spoke.";
            expect(await phonemizeEnNeural(s)).not.toBe(phonemize(s, "en"));
        });

        // REGRESSION GUARD: the tagger emits ARPABET internally (K S for ⟨x⟩) and renders it to IPA. A raw uppercase
        // ARPABET token leaking into the output (e.g. "…plɛKS") means a chunk-boundary bug — the output must be
        // all-lowercase IPA.
        test("no raw ARPABET leaks into OOV output (all-lowercase IPA)", async () => {
            for (const w of ["Zorplex", "Xylophraxy", "Quixotical", "Blexworth"]) {
                const out = await phonemizeEnNeural(w);
                expect(/[A-Z]/u.test(out), `${w} → ${out}`).toBe(false);
            }
        });

        test("out-of-vocab letter: tagger.tag() declines (returns \"\")", async () => {
            const tagger = await createEnglishTagger();
            expect(tagger).toBeDefined();
            expect(await tagger!.tag("мир")).toBe(""); // Cyrillic — no letter in the a–z training vocab
        });
    });
});

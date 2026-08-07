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
    });
});

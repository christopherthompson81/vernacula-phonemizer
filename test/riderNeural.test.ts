import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeRiderNeural, NEURAL_RIDERS } from "../src/languages/perso-arabic/riderNeural.ts";

// The neural GENERALIZATION tier is gated on the (gitignored-optional) ONNX model + onnxruntime-node.
const haveModel = existsSync(join(import.meta.dirname, "../src/languages/perso-arabic/riderDiacritizer.onnx"));

describe("rider neural diacritizer (two-layer path)", () => {
    test("NEURAL_RIDERS covers the four Perso-Arabic riders", () => {
        expect(new Set(NEURAL_RIDERS)).toEqual(new Set(["ur", "fa", "ps", "pa"]));
    });

    test("rejects a non-rider language", async () => {
        await expect(phonemizeRiderNeural("سلام", "ar")).rejects.toThrow(/not a neural rider/);
    });

    describe.skipIf(!haveModel)("with the ONNX model present", () => {
        // A lexicon-covered word takes the AUTHORITATIVE gold lexicon (the pre-pass leaves it bare for the sync
        // layer), so the neural path equals the sync path on it — precedence lexicon → neural → default.
        test("lexicon-covered word: neural path matches the sync lexicon output", async () => {
            expect(await phonemizeRiderNeural("مدرسه", "fa")).toBe(phonemize("مدرسه", "fa"));
            expect(await phonemizeRiderNeural("آبرو", "ur")).toBe(phonemize("آبرو", "ur"));
        });

        // An OOV compound the lexicon misses: the neural pre-pass supplies short vowels the default-schwa path
        // gets wrong — شناسی is [ʃenaːsiː] ('shenâsi'), so the neural restores the ش→[ʃe] the bare default reads
        // as [ʃa]. (Value updated after the 2026-07-16 full-diacritization retrain fixed the ش short vowel.)
        test("OOV word: neural restores vowels the default-schwa path misses", async () => {
            const sync = phonemize("زبانشناسی", "fa");
            const neural = await phonemizeRiderNeural("زبانشناسی", "fa");
            expect(neural).not.toBe(sync);
            expect(neural).toBe("zabaːnʃenaːsˈiː");
        });
    });
});

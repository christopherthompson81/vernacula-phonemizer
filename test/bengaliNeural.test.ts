import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeBnNeural } from "../src/bengaliNeural.ts";

// The neural OOV tagger is gated on the (optional) ONNX model + onnxruntime-node. When absent the path falls back
// to the sync engine, so the fallback contract is testable everywhere; the retagging assertions run only with the
// model present. See src/languages/bengali/bn-g2p-tagger.PROVENANCE.md.
const haveModel = existsSync(join(import.meta.dirname, "../src/languages/bengali/bn-g2p-tagger.int8.onnx"));

describe("bengali neural OOV tagger", () => {
    // Numbers, punctuation, clause assembly, and lexicon/common words are the SYNC engine's — the neural path only
    // swaps OOV word readings, so on lexicon-covered text it is byte-identical to phonemize(text, "bn").
    test("lexicon/common text: neural path is byte-identical to the sync path", async () => {
        for (const s of ["আমি বলি। তুমি কর।", "বই ও কলম।", "১৯৯৯ সালে।"]) {
            expect(await phonemizeBnNeural(s)).toBe(phonemize(s, "bn"));
        }
    });

    describe.skipIf(!haveModel)("with the ONNX model present", () => {
        // An OOV word the lexicon misses: the rule engine mis-defaults the inherent vowel to ɔ, but Bengali raises
        // it to [o] (a whole-word, non-rule-derivable decision the tagger's bidirectional pass reads). বক্তরা →
        // bɔkt̪oɾa (not the rule's bɔkt̪ɔɾa); নামকরা → namokɾa (not namɔkɾa).
        test("OOV word: tagger raises the inherent vowel the rule engine gets wrong", async () => {
            const neural = await phonemizeBnNeural("বক্তরা নামকরা।");
            expect(neural).not.toBe(phonemize("বক্তরা নামকরা।", "bn"));
            expect(neural).toBe("bɔkt̪oɾa namokɾa  । ");
        });

        // The consonant-consistency mask guarantees the tagger never alters the consonant skeleton or the number/
        // punctuation stream — only OOV inherent vowels move.
        test("mixed text: numbers + punctuation unchanged, only the OOV word retagged", async () => {
            expect(await phonemizeBnNeural("১৯৯৯ সালে বক্তরা।")).toBe("æk ɦad͡ʒaɾ nɔj ekʃo nɔj nɔbːoi ʃale bɔkt̪oɾa  । ");
        });
    });
});

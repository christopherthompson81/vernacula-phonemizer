import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeDaNeural } from "../src/languages/danish/danishNeural.ts";
import { createDanishTagger } from "../src/languages/danish/danishTagger.ts";

// The neural OOV tagger is gated on the (optional) ONNX model + onnxruntime-node. When absent the path falls back to
// the sync NST-lexicon + rule-g2p engine, so the fallback contract is testable everywhere; the retagging assertions run
// only with the model present.
const haveModel = existsSync(join(import.meta.dirname, "../src/languages/danish/da-g2p-tagger.int8.onnx"));

describe("danish neural OOV tagger", () => {
    // Lexicon words and punctuation are the SYNC engine's — the neural path only swaps genuinely-OOV word readings, so
    // on lexicon-covered text it is byte-identical to phonemize(text, "da").
    test("lexicon/common text: neural path is byte-identical to the sync path", async () => {
        for (const s of ["Jeg bor i en gade i København.", "Han har mad og øl."]) {
            expect(await phonemizeDaNeural(s)).toBe(phonemize(s, "da"));
        }
    });

    describe.skipIf(!haveModel)("with the ONNX model present", () => {
        // A genuinely-OOV word (not in the NST lexicon): the tagger reads it from spelling in the NST NARROW convention.
        // The rule g2p emits neither r-vocalisation nor stop-lenition; the BiLSTM learns both — so the neural reading
        // differs from the rule reading and carries the narrow ⟨-top⟩ → [tɐb] (r-vocalised, lenited) signature.
        test("OOV word: neural reading is NST-narrow and differs from the rule", async () => {
            const neural = (await phonemizeDaNeural("gribletop")).trim();
            expect(neural).not.toBe(phonemize("gribletop", "da").trim()); // rule = ɡʁˈibletop (no r-voc, no lenition)
            expect(neural).toMatch(/tɐb$/u); // ⟨-top⟩ → r-vocalised + lenited [tɐb]
        });

        test("out-of-vocab letter: tagger.tag() declines (returns \"\")", async () => {
            const tagger = await createDanishTagger();
            expect(tagger).toBeDefined();
            expect(await tagger!.tag("мир")).toBe(""); // Cyrillic — no letter in the training vocab
        });
    });
});

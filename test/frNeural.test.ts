import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeFrNeural } from "../src/frNeural.ts";
import { createFrenchTagger } from "../src/languages/french/frenchTagger.ts";

// The neural OOV tagger is gated on the (optional) ONNX model + onnxruntime-node. When absent the path falls back to
// the sync Lexique + rule-g2p engine, so the fallback contract is testable everywhere; the retagging assertions run
// only with the model present. See docs/investigations/fr_neural_oov_investigation.md.
const haveModel = existsSync(join(import.meta.dirname, "../src/languages/french/fr-g2p-tagger.int8.onnx"));

describe("french neural OOV tagger", () => {
    // Lexicon words, numbers, liaison, and punctuation are the SYNC engine's — the neural path only swaps
    // genuinely-OOV word readings, so on lexicon-covered text it is byte-identical to phonemize(text, "fr").
    test("lexicon/common text: neural path is byte-identical to the sync path", async () => {
        for (const s of ["Le chat est sur la table.", "Nous avons vingt-trois ans.", "Elle lit deux livres."]) {
            expect(await phonemizeFrNeural(s)).toBe(phonemize(s, "fr"));
        }
    });

    describe.skipIf(!haveModel)("with the ONNX model present", () => {
        // A genuinely-OOV word (not in Lexique): the tagger reads it from spelling. The rule g2p wrongly VOICES the
        // silent 3rd-person-plural verb ending ⟨-issent⟩ as [ɑ̃]; the BiLSTM learns the silent form — so the neural
        // reading differs from the rule reading and does NOT end in the nasal ɑ̃.
        test("OOV verb: the silent -ent ending is not voiced (differs from the rule)", async () => {
            const s = "Ils gribouillissent.";
            const neural = await phonemizeFrNeural(s);
            expect(neural).not.toBe(phonemize(s, "fr"));
            expect(neural).not.toMatch(/ɑ̃\s*$/u); // the -issent must be silent, not …ɑ̃
        });

        test("out-of-vocab letter: tagger.tag() declines (returns \"\")", async () => {
            const tagger = await createFrenchTagger();
            expect(tagger).toBeDefined();
            expect(await tagger!.tag("мир")).toBe(""); // Cyrillic — no letter in the training vocab
        });
    });
});

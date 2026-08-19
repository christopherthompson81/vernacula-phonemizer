import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { phonemize, phonemizeAsync } from "../src/index.ts";
import { bizrokeLexiconHas, phonemizeWordRules } from "../src/languages/central-kurdish/central-kurdish.ts";
import { phonemizeCkbNeural } from "../src/languages/central-kurdish/centralKurdishNeural.ts";
import { createCentralKurdishTagger } from "../src/languages/central-kurdish/centralKurdishTagger.ts";

// The bizroke tagger is gated on the (optional) ONNX model + onnxruntime-node. When absent the path falls back
// to the sync engine, so the fallback contract is testable everywhere; the retagging assertions need the model.
const haveModel = existsSync(join(import.meta.dirname, "../src/languages/central-kurdish/ckb-bizroke-tagger.int8.onnx"));

describe("central kurdish bizroke tagger", () => {
    // Numbers, punctuation, normalization and clause assembly belong to the SYNC engine — the neural path only
    // swaps OOV word readings. On lexicon-covered text it must be byte-identical.
    test("lexicon-covered text: neural path is byte-identical to the sync path", async () => {
        for (const s of [
            "کرد گشت من",           // three lexicon hits
            "٢٠٢٤ ساڵ",             // Arabic-Indic digits — the number composer, which is the sync engine's
            "زۆر باشە، سوپاس.",     // clause punctuation
        ]) {
            expect(await phonemizeCkbNeural(s), s).toBe(phonemize(s, "ckb"));
        }
    });

    describe.skipIf(!haveModel)("with the ONNX model present", () => {
        // ⚠ THE TIER ONLY FIRES BELOW THE LEXICON. Assert the precondition rather than assume it, or the
        // assertions below could pass on a lexicon hit and say nothing about the tagger.
        test("the test words really are OOV", () => {
            for (const w of ["ملیۆنێک", "پەرلەمانتارەکان"]) expect(bizrokeLexiconHas(w), w).toBe(false);
        });

        // The class the rule engine cannot reach: ملیۆنێک has no written short vowel, so the rules emit
        // *mljoːneːk* — a syllable with no nucleus, impossible rather than merely variant.
        test("OOV word: the tagger supplies the bizroke the rules cannot", async () => {
            expect(phonemizeWordRules("ملیۆنێک")).toBe("mljoːneːk");
            expect(await phonemizeCkbNeural("ملیۆنێک")).toBe("mɪljoːneːk");
            // ⚠ through `phonemizeAsync`, not just the entry point — the whole tier is inert unless
            // neuralRegistry.ts routes `ckb` here, and nothing else in the suite covers that wiring.
            expect(await phonemizeAsync("ملیۆنێک", "ckb")).toBe("mɪljoːneːk");
        });

        // ⚠ THE SAFETY PROPERTY, AND THE REASON THE INPUT IS OUR OWN RULE OUTPUT RATHER THAN THE ORTHOGRAPHY:
        // every tag is either a symbol or that symbol + ɪ, so the consonant-consistency mask makes altering the
        // skeleton structurally impossible. Deleting the ɪ from the tagger's reading must give back the rules'.
        // A tagger reading the abjad directly would have no such guarantee — it could rewrite any phone.
        test("the tagger can ONLY insert ɪ — never alter the skeleton", async () => {
            const tagger = await createCentralKurdishTagger();
            for (const w of ["ملیۆنێک", "پەرلەمانتارەکان", "خوێندکارانی", "بەرپرسیارێتی", "دەستپێکردنی"]) {
                const out = await tagger!.tag(w);
                expect(out.length, w).toBeGreaterThan(0);
                expect(out.replace(/ɪ/gu, ""), w).toBe(phonemizeWordRules(w));
            }
        });

        // An unseen symbol has no entry in the model's `src`, so the shared factory declines the whole word and
        // the rule reading stands. There is no `<unk>` here — unlike sd/bn, no tag is worth guessing.
        test("a word whose rule reading contains an unseen symbol declines to the rules", async () => {
            const tagger = await createCentralKurdishTagger();
            expect(await tagger!.tag("ⵣⵣ")).toBe("");
        });
    });
});

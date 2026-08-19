import { existsSync, readFileSync } from "node:fs";
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

        // ⚠ THIS REPLACED A TEST THAT PASSED FOR THE WRONG REASON. It asserted that a non-Sorani word declines
        // (`tag("ⵣⵣ") === ""`) — but `phonemizeWordRules("ⵣⵣ")` is "", so the factory returns at its `T === 0`
        // early exit and never consults the vocab. The decline path it meant to cover turns out to be
        // UNREACHABLE from real Sorani, because every symbol this engine can emit is in the model's `src`.
        // That is the property actually worth guarding: add a grapheme to central-kurdish.jsonc without
        // retraining and the tier would silently start declining every word containing it, with no error and
        // no test failure — just the bizroke quietly missing from a slice of the vocabulary.
        test("every symbol the engine can emit is in the model vocab (else the tier silently declines)", async () => {
            const meta = JSON.parse(
                readFileSync(join(import.meta.dirname, "../src/languages/central-kurdish/ckb-bizroke-tagger.meta.json"), "utf8"),
            ) as { src: Record<string, number> };
            const def = JSON.parse(
                readFileSync(join(import.meta.dirname, "../src/languages/central-kurdish/central-kurdish.jsonc"), "utf8")
                    .replace(/^\s*\/\/.*$/gmu, ""),
            ) as { consonants: Record<string, string>; vowels: Record<string, string> };
            const emitted = new Set([...Object.values(def.consonants), ...Object.values(def.vowels)].flatMap((v) => [...v]));
            expect([...emitted].filter((c) => !(c in meta.src)).sort()).toEqual([]);
        });

        // The `T === 0` early exit: nothing to tag, so nothing to say. Distinct from a decline, and asserted
        // separately so neither can stand in for the other again.
        test("a word the rule engine reads as nothing yields nothing", async () => {
            const tagger = await createCentralKurdishTagger();
            expect(phonemizeWordRules("ⵣⵣ")).toBe("");
            expect(await tagger!.tag("ⵣⵣ")).toBe("");
        });
    });
});

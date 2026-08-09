import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { afrikaansLexiconHas } from "../src/languages/afrikaans/afrikaans.ts";
import { phonemizeAfNeural } from "../src/languages/afrikaans/afrikaansNeural.ts";
import { createAfrikaansTagger } from "../src/languages/afrikaans/afrikaansTagger.ts";

// The neural OOV tagger is gated on the (optional) ONNX model + onnxruntime-node. When absent the path falls back
// to the sync engine, so the fallback contract is testable everywhere; the retagging assertions need the model.
const haveModel = existsSync(join(import.meta.dirname, "../src/languages/afrikaans/af-g2p-tagger.int8.onnx"));

describe("afrikaans neural OOV tagger", () => {
    // Numbers, punctuation, normalization, clause assembly and every lexicon-covered word belong to the SYNC
    // engine — the neural path only swaps OOV word readings. On lexicon-covered text it must be byte-identical.
    test("lexicon/common text: neural path is byte-identical to the sync path", async () => {
        for (const s of [
            "Die man loop huis toe.", "Ek het 100 boeke.", "Dit is 12,5 kilometer.",
            // ⚠ THESE TWO ARE THE POINT. The first draft of this test picked three strings that happened to
            // contain no ⟨'n⟩ and no bare letter, so it stayed green while the tier claimed BOTH — reading
            // ⟨'n⟩, the most frequent word in Afrikaans, as [n] instead of [ə], and ⟨C⟩ as the phone [k]
            // instead of the letter name [siə] (silently reverting #761). A byte-identity test is only worth
            // what its strings cover.
            "Dit is 'n boek.", "Vitamien C is goed.",
        ]) {
            expect(await phonemizeAfNeural(s), s).toBe(phonemize(s, "af"));
        }
    });

    // ⚠ NFC, matching phonemizeWord's own key: on decomposed input the prepass would otherwise store under the
    // NFD key while the lookup asks for the NFC one, discarding every reading — switching the tier off for
    // exactly the diacritic-bearing words it is needed for.
    test("decomposed (NFD) input reaches the tagger too", async () => {
        const s = "Die reënwater is groot.";
        expect(await phonemizeAfNeural(s.normalize("NFD"))).toBe(await phonemizeAfNeural(s));
    });

    describe.skipIf(!haveModel)("with the ONNX model present", () => {
        // ⚠ THE TIER ONLY FIRES BELOW BOTH LEXICONS. These words are in neither, which is the precondition for
        // the assertion below meaning anything — assert it rather than assume it.
        test("the test words really are OOV", () => {
            for (const w of ["kwantumverstrengeling", "rekenaarwetenskaplike"])
                expect(afrikaansLexiconHas(w), w).toBe(false);
        });

        // A genuinely-OOV compound: the tagger reads the stress-conditioned vowel quality from spelling, which is
        // the class the rule engine cannot reach (74.8% stress placement overall, 40% at eight syllables).
        // Held-out (dictionary-gold): tagger 91.4% word-exact against the rule engine's 63.5%.
        test("OOV word: the tagger fills the tail, differing from the rule-only reading", async () => {
            const s = "Die rekenaarwetenskaplike werk.";
            expect(await phonemizeAfNeural(s)).not.toBe(phonemize(s, "af"));
        });

        // ⚠ af EMITS NO STRESS MARK BY CONVENTION — unlike nb, whose tag alphabet embeds ˈ. The tagger must not
        // introduce one, or its output would be inconsistent with every word the lexicon and rule tiers produce.
        test("tagger output carries no stress marks and no syllable dots", async () => {
            const tagger = await createAfrikaansTagger();
            for (const w of ["kwantumverstrengeling", "rekenaarwetenskaplike", "aandagafleibaarheid"]) {
                const out = await tagger!.tag(w);
                expect(out, w).not.toMatch(/[ˈˌ.]/u);
                expect(out.length, w).toBeGreaterThan(0);
            }
        });
    });
});

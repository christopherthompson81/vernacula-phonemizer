import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeNbNeural } from "../src/languages/norwegian/norwegianNeural.ts";
import { createNorwegianTagger } from "../src/languages/norwegian/norwegianTagger.ts";

// The neural OOV tagger is gated on the (optional) ONNX model + onnxruntime-node. When absent the path falls back to
// the sync engine, so the fallback contract is testable everywhere; the retagging assertions run only with the model
// present.
const haveModel = existsSync(join(import.meta.dirname, "../src/languages/norwegian/nb-g2p-tagger.onnx"));

describe("norwegian neural OOV tagger", () => {
    // Numbers, punctuation, clause assembly, and lexicon/common words are the SYNC engine's — the neural path only
    // swaps OOV word readings, so on lexicon-covered text it is byte-identical to phonemize(text, "nb").
    test("lexicon/common text: neural path is byte-identical to the sync path", async () => {
        for (const s of ["Norsk er et språk.", "Jeg har en bok.", "Det er 100 hus."]) {
            expect(await phonemizeNbNeural(s)).toBe(phonemize(s, "nb"));
        }
    });

    describe.skipIf(!haveModel)("with the ONNX model present", () => {
        // A genuinely-OOV word (not in the NST lexicon): the tagger reads its stress + vowel quality directly from
        // spelling. The exact expectations are captured from the shipped model and they are OUR deliberate output,
        // the OOV-tail refinement over the rule engine's first-syllable guess.
        test("OOV word: tagger fills the tail (differs from the rule-only reading)", async () => {
            const s = "Kvantekromodynamikken forbløffer.";
            expect(await phonemizeNbNeural(s)).not.toBe(phonemize(s, "nb"));
        });

        // Convention invariant: the tag alphabet embeds ˈ and per-position argmax has no global stress constraint, so
        // raw output can carry doubled/zero/multiple primary marks (paella→pɑˈˈɛlɑ). oneStress() must normalize every
        // word to EXACTLY ONE primary ˈ and no adjacent stress marks — the same invariant the lexicon + rule tiers hold.
        test("tagger output always has exactly one primary stress, no doubled marks", async () => {
            const tagger = await createNorwegianTagger();
            for (const w of ["paella", "entrepreneur", "desentraliseringsreform", "cappuccino", "kroppsøving"]) {
                const out = await tagger!.tag(w);
                expect(out.match(/ˈ/gu)?.length, `${w} → ${out}`).toBe(1); // exactly one primary
                expect(/[ˈˌ]{2}/u.test(out), `${w} → ${out}`).toBe(false); // no adjacent stress marks
            }
        });

        // The mask-decline safety net: the training vocab covers every letter the nb TOKEN regex admits, so a decline
        // can't be reached through phonemizeNbNeural — but the tagger.tag() contract must still return "" (not an
        // arbitrary tag) for a grapheme outside the vocab, so a caller that hands it foreign text defers cleanly.
        test("out-of-vocab grapheme: tagger.tag() declines (returns \"\")", async () => {
            const tagger = await createNorwegianTagger();
            expect(tagger).toBeDefined();
            expect(await tagger!.tag("мир")).toBe(""); // Cyrillic — no letter in the training vocab
        });
    });
});

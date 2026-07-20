import { describe, expect, test } from "vitest";

import { getPhonemizer } from "../src/registry.ts";

// Haryanvi (bgc) is an ALIAS to the Hindi engine — a labelled approximation, NOT a bespoke module. Haryanvi is
// Western Hindi (Hindustani group), segmentally ~= Hindi; its documented differences from Hindi (vowel
// free-variation a~e/i~e, a marked retroflexion tendency, intonation) are allophonic/prosodic, not a categorical
// grapheme→IPA delta, and there is NO referee (no wikipron/kaikki/epitran) to verify one. So `hi` is its nearest
// verified sibling. Unlike the eastern belt (mag→bho with श→s), Haryanvi keeps श=[ʃ] (Hindi), so the target is hi.
// This test locks the alias: bgc === hi. If Haryanvi ever gets a verified delta, replace the alias + this test.
describe("Haryanvi (bgc) — alias to the Hindi engine", () => {
    const bgc = getPhonemizer("bgc");
    const hi = getPhonemizer("hi");
    test("routes to hi: identical IPA for Devanagari input", () => {
        for (const w of ["हरियाणवी", "पानी", "शहर", "लड़का", "किताब", "आदमी"]) {
            expect(bgc.text(w)).toBe(hi.text(w));
        }
    });
    test("keeps श=[ʃ] (Western Hindi — NOT the eastern श→s of bho/mag)", () => {
        expect(bgc.text("शहर")).toBe("ʃˈɛɦɛɾ");
    });
});

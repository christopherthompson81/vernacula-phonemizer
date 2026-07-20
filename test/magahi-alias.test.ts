import { describe, expect, test } from "vitest";

import { getPhonemizer } from "../src/registry.ts";

// Magahi (mag) is an ALIAS to the Bhojpuri engine — a labelled approximation, NOT a bespoke module. Magahi has no
// independent referee (kaikki = 2 IPA entries, no wikipron/epitran) and no confidently-encodable delta from
// Bhojpuri; the one distinctive feature the literature attests (श→s, विशाल→bisɑl; Priya 2020) is exactly a
// Bhojpuri feature, so `bho` is its nearest verified sibling. This test locks the alias: mag === bho for Devanagari
// input. If Magahi ever gets a verified Magahi-specific delta, replace the alias with a bespoke module and this test.
describe("Magahi (mag) — alias to the Bhojpuri engine", () => {
    const mag = getPhonemizer("mag");
    const bho = getPhonemizer("bho");
    test("routes to bho: identical IPA for Devanagari input", () => {
        for (const w of ["विशाल", "मगही", "पानी", "शहर", "किताब", "आदमी"]) {
            expect(mag.text(w)).toBe(bho.text(w));
        }
    });
    test("carries the shared eastern features श→s + व→w (viʃaːl → wisɑl, not Hindi ʋɪʃaːl)", () => {
        expect(mag.text("विशाल")).toBe("wˈisɑl");
    });
});

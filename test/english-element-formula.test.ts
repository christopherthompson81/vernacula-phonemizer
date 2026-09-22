/**
 * Listed element-symbol formulae (#1424) — `CoCr` read as the word *cocker*.
 *
 * ⚠ THESE PIN A LIST, NOT A PARSER, and that is deliberate. A rule that tiled any token into element
 * symbols was built and thrown away: deciding that `CoCo` is not a compound needs valency and
 * stoichiometry, not a spelling test, so the general mechanism had the shape of chemistry knowledge
 * without the substance. The cases below therefore assert what IS claimed — the listed tokens — and
 * that an unlisted lookalike is left alone.
 */
import { describe, expect, test } from "vitest";
import { normalizeEnglish } from "../src/languages/english/normalize.ts";
import { phonemize } from "../src/index.ts";

describe("a listed element-symbol formula reads as its element names", () => {
    test("the reported token, alone and in a frame", () => {
        expect(normalizeEnglish("CoCr")).toBe("cobalt chromium");
        expect(normalizeEnglish("a CoCr alloy")).toBe("a cobalt chromium alloy");
        expect(normalizeEnglish("CoCrMo")).toBe("cobalt chromium molybdenum");
    });

    // ⚠ LONGEST-FIRST, or `CoCrMo` is claimed as `CoCr` with a stranded ⟨Mo⟩ reaching the g2p as
    // letters — the leak class this file's unit rules document at length.
    test("the longer token wins", () => {
        expect(normalizeEnglish("CoCrMo")).not.toContain("cobalt chromium Mo");
    });

    // ⚠ THE CAPITALISATION IS THE SIGNAL. An element symbol is `[A-Z]` or `[A-Z][a-z]`, and case alone
    // separates a formula from the word it spells — which the dictionary cannot do, since `sic`, `tin`
    // and `nan` are all recorded entries.
    test("the lookup is case-sensitive", () => {
        expect(normalizeEnglish("cocr")).toBe("cocr");
        expect(normalizeEnglish("COCR")).toBe("COCR");
        expect(normalizeEnglish("Cocr")).toBe("Cocr");
    });

    // ⚠ AN UNLISTED LOOKALIKE IS LEFT ALONE, which is the property the list buys over a parser. `CoCo`
    // is a name; nothing here claims to know that, and nothing here has to.
    test("an unlisted token is untouched", () => {
        for (const w of ["CoCo", "Coco Chanel", "CoCrX", "NaCl", "SiC", "InDesign", "Nano"])
            expect(normalizeEnglish(w)).toBe(w);
    });

    // ⚠ THE HYPHENATED SPELLINGS ARE ROWS, NOT AN ACCIDENT. The boundary deliberately does not
    // exclude ⟨-⟩, so `CoCr-based` reads correctly — but that also meant `CoCr-Mo` matched `CoCr` and
    // stranded a bare ⟨Mo⟩. A half-expansion is the worst outcome available, because it sounds
    // finished.
    test("a hyphenated spelling of a listed alloy does not half-expand", () => {
        expect(normalizeEnglish("CoCr-Mo")).toBe("cobalt chromium molybdenum");
        expect(normalizeEnglish("Co-Cr-Mo")).toBe("cobalt chromium molybdenum");
        expect(normalizeEnglish("Co-Cr")).toBe("cobalt chromium");
        expect(normalizeEnglish("CoCr-based")).toBe("cobalt chromium-based");
        expect(normalizeEnglish("a CoCr-based alloy")).toBe("a cobalt chromium-based alloy");
    });

    // ⚠ AND AN UNLISTED LONGER ALLOY IS REFUSED WHOLE. `Co-Cr-Mo-W` is real and not listed; matching
    // the listed prefix would read "cobalt chromium molybdenum-W". Declining is where a list stops
    // honestly — it claims only what it knows.
    test("an unlisted longer alloy is refused rather than half-read", () => {
        expect(normalizeEnglish("Co-Cr-Mo-W")).toBe("Co-Cr-Mo-W");
        expect(normalizeEnglish("CoCr-X")).toBe("CoCr-X");
    });

    test("the token is bounded", () => {
        expect(normalizeEnglish("XCoCr")).toBe("XCoCr");
        expect(normalizeEnglish("CoCr2")).toBe("CoCr2");
    });

    // ⚠ DERIVED, NOT TYPED. Hand-written IPA in a test here has been wrong every time.
    test("the reported reading is gone", () => {
        expect(phonemize("CoCr", "en")).toBe(phonemize("cobalt chromium", "en"));
        expect(phonemize("CoCr", "en")).not.toBe(phonemize("cocker", "en"));
    });
});

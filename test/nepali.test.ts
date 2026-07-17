import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/nepali/nepali.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Nepali / नेपाली (ne) — Indo-Aryan, Devanagari. Reuses the Hindi engine with the
// Nepali divergences: the inherent vowel realised as [ʌ] (not ə), the DENTAL affricates च/छ/ज/झ→[t͡s t͡sʰ d͡z d͡zʱ]
// (not palatal), the sibilant merger श/ष→[s], NO phonemic vowel length (ई→i, ऊ→u), diphthongs ऐ→[ʌi]/औ→[ʌu],
// व→[w]. Validated at 68.9% vs wikipron nep narrow + 67.8% vs kaikki. See docs/investigations/ne_native_bringup_investigation.md.
describe("Nepali canonical IPA", () => {
    test("inherent vowel [ʌ] (not Hindi ə)", () => {
        expect(phonemizeWord("गर्नु")).toBe("ɡˈʌɾnu"); // 'to do' — inherent → ʌ
        expect(phonemizeWord("अचार")).toBe("ˈʌt͡saɾ"); // initial अ → ʌ
    });

    test("dental affricates च/छ → [t͡s]/[t͡sʰ] (not palatal)", () => {
        expect(phonemizeWord("मान्छे")).toBe("mˈant͡sʰe"); // छ → t͡sʰ (Hindi t͡ʃʰ)
        expect(phonemizeWord("अचार")).toBe("ˈʌt͡saɾ"); // च → t͡s
    });

    test("sibilant merger श/ष → [s]; no phonemic vowel length", () => {
        expect(phonemizeWord("भाषा")).toBe("bʱˈasa"); // ष → s, आ → a (no length)
        expect(phonemizeWord("नेपाल")).toBe("nˈepal"); // ई/ा short
        expect(phonemizeWord("हिमाल")).toBe("ɦˈimal"); // 'mountain'
    });

    test("embedded English keeps its schwa — only Devanagari ə becomes ʌ", () => {
        // The ə→ʌ realisation must NOT touch the (contrastive) English /ə/ in an embedded Latin run.
        const out = getPhonemizer("ne").text("म computer").trim();
        expect(out).toContain("kəmpj"); // 'computer' keeps ə, not kʌmpj
        expect(out.startsWith("mˈʌ")).toBe(true); // the Nepali म → mʌ
    });

    test("numbers (Nepali words; 21-99 compounds deferred)", () => {
        expect(getPhonemizer("ne").text("6").trim()).toBe("t͡sʰˈʌ"); // छ (dental affricate)
        expect(getPhonemizer("ne").text("2").trim()).toBe("d̪ˈui"); // दुई
        expect(getPhonemizer("ne").text("100").trim()).toBe("ˈek sˈʌj"); // एक सय
    });
});

import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/totontepecmixe/totontepecmixe.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Totontepec Mixe / ayöök (mto) — Mixe-Zoquean (the fleet's FIRST), the modern SIL
// orthography. AUTHORED from Crawford, *Totontepec Mixe Phonotagmemics* (SIL 1963). The consonants + allophony are
// Crawford-grounded (the allophony goldens below reproduce his exact transcriptions, e.g. mpahk→[mbahk],
// cingavus→[tsingavus]); the vowel-orthography mapping is reconstructed from his example words. See
// docs/investigations/mto_native_bringup_investigation.md.
describe("Totontepec Mixe (ayöök) canonical IPA", () => {
    test("the vowel anchors (Crawford example words)", () => {
        expect(phonemizeWord("kääm")).toBe("kæːm"); // 'pig' — ⟨ä⟩=/æ/ (Crawford /kæːm/); doubled = length
        expect(phonemizeWord("këp")).toBe("kɨp"); // 'tree' — ⟨ë⟩=/ɨ/ (Crawford /kɨp/)
        expect(phonemizeWord("üts")).toBe("ʌt͡s"); // 'I' — ⟨ü⟩=/ʌ/; ⟨ts⟩=[t͡s]
        expect(phonemizeWord("ök")).toBe("ʊk"); // 'dog' — ⟨ö⟩=/ʊ/
    });

    test("consonants: ⟨ts⟩/⟨cy⟩/⟨x⟩/⟨j⟩/⟨c⟩/glottal", () => {
        expect(phonemizeWord("tsaa")).toBe("t͡saː"); // 'stone' — ⟨ts⟩=[t͡s]
        expect(phonemizeWord("caacy")).toBe("kaːt͡ʃ"); // 'tortilla' — ⟨c⟩=[k], ⟨cy⟩=[t͡ʃ] (palatalized)
        expect(phonemizeWord("tsojx")).toBe("t͡sohʃ"); // 'knife' — ⟨j⟩=[h], ⟨x⟩=[ʃ]
        expect(phonemizeWord("joꞌc")).toBe("hoʔk"); // 'owl' — ⟨j⟩=[h], saltillo ⟨ꞌ⟩=[ʔ], ⟨c⟩=[k]
    });

    test("★ the Crawford ALLOPHONY: post-nasal voicing + intervocalic ⟨d g⟩→[ð ɣ] + ⟨ny⟩→[ɲ]", () => {
        expect(phonemizeWord("cumantoc")).toBe("kumandok"); // 'nahualism' — POST-NASAL: ⟨nt⟩→[nd]
        expect(phonemizeWord("tocu̱nágu̱c")).toBe("tokunaɣuk"); // 'toad' — intervocalic ⟨g⟩→[ɣ]; the UNDERLINE + the ACUTE stress-mark are stripped (not emitted), so the vowel is read not dropped
        expect(phonemizeWord("mpahk")).toBe("mbahk"); // Crawford's own example: ⟨mp⟩→[mb] ('your bone')
        expect(phonemizeWord("nyuhm")).toBe("ɲum̥"); // ⟨ny⟩→[ɲ]; ⟨hm⟩ → the VOICELESS nasal [m̥] (Crawford §1.121)
    });

    test("registry wiring", () => {
        expect(getPhonemizer("mto").text("kääm").trim()).toBe("kæːm");
    });
});

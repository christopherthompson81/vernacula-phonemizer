import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/santali/santali.ts";

// Canonical-IPA goldens for Santali (sat) — ᱥᱟᱱᱛᱟᱲᱤ, Munda (Austroasiatic), the OL CHIKI alphabet (U+1C50–1C7F), the
// fleet's first Munda language + first Ol Chiki. A grapheme scan + sign rules: ⟨ᱷ⟩ aspirates the preceding stop
// (ᱵᱷ→bʱ), ⟨ᱹ⟩ modifies the vowel (ᱟᱹ→ə), ⟨ᱸ⟩ nasalizes it (ᱟᱸ→ã), and the HALLMARK — a word-final voiced stop is
// CHECKED/glottalized (ᱫᱟᱜ→dakʼ, ᱢᱮᱫ→metʼ). Referee: kaikki Santali (490 human). See docs/investigations/sat_native_bringup_investigation.md.
describe("Santali (ᱥᱟᱱᱛᱟᱲᱤ) canonical IPA", () => {
    test("word-final CHECKED stops (the Santali hallmark)", () => {
        expect(phonemizeWord("ᱫᱟᱜ")).toBe("dakʼ"); // 'water' — final ⟨ᱜ⟩ ɡ→checked [kʼ]
        expect(phonemizeWord("ᱢᱮᱫ")).toBe("metʼ"); // 'eye' — final ⟨ᱫ⟩ d→[tʼ]
        expect(phonemizeWord("ᱪᱮᱫ")).toBe("cetʼ"); // 'what' — ⟨ᱪ⟩→c, final ⟨ᱫ⟩→[tʼ]
        expect(phonemizeWord("ᱦᱚᱲ")).toBe("hɔɽ"); // 'person/Santal' — ⟨ᱲ⟩→ɽ (no checking on a sonorant)
    });

    test("nasalization ⟨ᱸ⟩, vowel-mod ⟨ᱹ⟩→ə, aspiration ⟨ᱷ⟩", () => {
        expect(phonemizeWord("ᱪᱟᱸᱫᱚ")).toBe("cãdɔ"); // 'moon' — ⟨ᱟᱸ⟩→[ã], ⟨ᱚ⟩→ɔ
        expect(phonemizeWord("ᱯᱟᱹᱨᱥᱤ")).toBe("pərsi"); // 'language' — ⟨ᱟᱹ⟩→[ə]
        expect(phonemizeWord("ᱵᱷᱟᱨᱚᱛ")).toBe("bʱarɔt"); // 'India' — ⟨ᱵᱷ⟩→[bʱ] aspirated
    });

    test("palatal ⟨ᱡ⟩→ɟ, the script's own name, and a multi-word phrase", () => {
        expect(phonemizeWord("ᱚᱡᱚ")).toBe("ɔɟɔ"); // ⟨ᱡ⟩ AAJ → palatal stop [ɟ]
        expect(phonemizeWord("ᱥᱟᱱᱛᱟᱲᱤ")).toBe("santaɽi"); // 'Santali'
        expect(phonemizeWord("ᱚᱞ ᱪᱮᱢᱮᱫ")).toBe("ɔl cemetʼ"); // 'Ol Chemet' (the script) — checking applies per word
    });

    test("⟨ᱽ AHAD⟩ blocks final checking; ⟨ᱶ OV⟩→w̃; nasalized/ɛ nucleus still checks", () => {
        expect(phonemizeWord("ᱨᱳᱜ")).toBe("rokʼ"); // final ⟨ᱜ⟩ ɡ→checked [kʼ]
        expect(phonemizeWord("ᱨᱳᱜᱽ")).toBe("roɡ"); // + ⟨ᱽ AHAD⟩ → PLAIN, unchecked (the minimal pair)
        expect(phonemizeWord("ᱥᱟᱶ")).toBe("saw̃"); // ⟨ᱶ OV⟩ = the NASAL glide [w̃] (vs ⟨ᱣ⟩ [w])
        expect(phonemizeWord("ᱥᱮᱺᱜᱮᱹᱞ")).toBe("sɛ̃ɡɛl"); // ⟨ᱮᱺ⟩ → lowered+nasalized [ɛ̃]
    });
});

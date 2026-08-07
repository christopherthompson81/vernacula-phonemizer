import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/santali/santali.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Santali (sat) — ᱥᱟᱱᱛᱟᱲᱤ, Munda (Austroasiatic), the OL CHIKI alphabet (U+1C50–1C7F), the
// fleet's first Munda language + first Ol Chiki. A grapheme scan + sign rules: ⟨ᱷ⟩ aspirates the preceding stop
// (ᱵᱷ→bʱ), ⟨ᱹ⟩ modifies the vowel (ᱟᱹ→ə), ⟨ᱸ⟩ nasalizes it (ᱟᱸ→ã), and the HALLMARK — a word-final voiced stop is
// CHECKED/glottalized (ᱫᱟᱜ→dakʼ, ᱢᱮᱫ→metʼ). Referee: kaikki Santali (490 human).
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

    // ═══ CARDINAL NUMBERS — the NATIVE MUNDA decimal series (ᱜᱮᱞ 'ten' as the base) for 1–99, with the
    // Indo-Aryan loan magnitudes above it, in Indian 2-2-3 grouping. Sources in src/languages/santali/numbers.ts.
    test("cardinals: native ᱜᱮᱞ decimal, SPACED, purely additive", () => {
        const sat = getPhonemizer("sat");
        expect(sat.text("0").trim()).toBe("sun"); // ᱥᱩᱱ — an IA loan; no native Munda zero exists
        expect(sat.text("5").trim()).toBe("mɔɳe"); // ᱢᱚᱬᱮ
        expect(sat.text("11").trim()).toBe("ɡel mitʼ"); // ᱜᱮᱞ ᱢᱤᱫ — SPACED in Ol Chiki practice
        expect(sat.text("25").trim()).toBe("bar ɡel mɔɳe"); // ᱵᱟᱨ ᱜᱮᱞ ᱢᱚᱬᱮ — attested; 'two-ten-five'
        expect(sat.text("47").trim()).toBe("pun ɡel ejaj"); // ᱯᱩᱱ ᱜᱮᱞ ᱮᱭᱟᱭ — Ghosh's own worked example
        // The multiplier ONE is written in Santali (unlike Maltese/Lule Sami, which drop it).
        expect(sat.text("100").trim()).toBe("mitʼ saj"); // ᱢᱤᱫ ᱥᱟᱭ, never bare ᱥᱟᱭ
    });

    test("cardinals: IA loan magnitudes + Indian 2-2-3 grouping (no million/billion exists)", () => {
        const sat = getPhonemizer("sat");
        expect(sat.text("1200").trim()).toBe("mitʼ haɟar bar saj"); // ᱢᱤᱫ ᱦᱟᱡᱟᱨ ᱵᱟᱨ ᱥᱟᱭ — attested in prose
        expect(sat.text("5000").trim()).toBe("mɔɳe haɟar"); // ᱢᱚᱬᱮ ᱦᱟᱡᱟᱨ — attested
        expect(sat.text("100000").trim()).toBe("mitʼ lakʰ"); // ᱢᱤᱫ ᱞᱟᱠᱷ — 10⁵ is a LAKH, not "hundred thousand"
        expect(sat.text("1000000").trim()).toBe("ɡel lakʰ"); // ᱜᱮᱞ ᱞᱟᱠᱷ = ten lakh — Santali has no "million"
        expect(sat.text("10000000").trim()).toBe("mitʼ kɔrɔɽ"); // ᱢᱤᱫ ᱠᱚᱨᱚᱲ — 10⁷ is a CRORE
    });

    test("cardinals: OL CHIKI digits ᱐-᱙ compose exactly like Western ones", () => {
        // U+1C50–1C59. ᱒᱕ is the same number as 25, so it must read identically.
        expect(getPhonemizer("sat").text("᱒᱕").trim()).toBe("bar ɡel mɔɳe");
    });
});

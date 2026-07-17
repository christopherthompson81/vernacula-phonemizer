import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/sindhi/sindhi.ts";

// Canonical-IPA goldens for Sindhi (sd) — Perso-Arabic ABJAD, Indo-Aryan. The signature is the four-way IMPLOSIVE
// series ٻ→ɓ, ڏ→ɗ, ڄ→ʄ, ڳ→ɠ (a census gap) + the retroflex series ٽ ٺ ڊ ڍ ڻ ڙ + aspiration (ڀ bʰ, ٿ t̪ʰ,
// جھ d͡ʒʰ, لھ lʰ). SHORT vowels are unwritten → a default [ə] (the abjad wall). See docs/sd_native_bringup_investigation.md.
describe("Sindhi canonical IPA", () => {
    test("the four implosives ٻɓ ڏɗ ڄʄ ڳɠ (the census gap)", () => {
        expect(phonemizeWord("ٻارو")).toBe("ɓaːɾoː"); // ٻ → ɓ
        expect(phonemizeWord("ڏاڏو")).toBe("ɗaːɗoː"); // ڏ → ɗ
        expect(phonemizeWord("ڄاڻ")).toBe("ʄaːɳə"); // ڄ → ʄ, ڻ → ɳ (retroflex)
        expect(phonemizeWord("ڳالھ")).toBe("ɠaːlʰə"); // ڳ → ɠ, لھ → lʰ (aspirated sonorant)
    });

    test("consonants, aspiration, retroflex, long vowels", () => {
        expect(phonemizeWord("ڪتاب")).toBe("kət̪aːbə"); // ڪ→k, ت→t̪ (dental), ا→aː
        expect(phonemizeWord("سنڌ")).toBe("sənəd̪ʰə"); // ڌ → d̪ʰ (aspirated dental)
        expect(phonemizeWord("پنج")).toBe("pəɲəd͡ʒə"); // ن → ɲ before ج (palatal nasal assimilation)
    });

    test("word-final ه silent (vowel-carrier), ع silent", () => {
        expect(phonemizeWord("ٻه")).toBe("ɓə"); // final ه silent → ɓ + default ə
    });
});

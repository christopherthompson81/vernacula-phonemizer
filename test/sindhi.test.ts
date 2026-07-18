import { describe, expect, test } from "vitest";

// The RULE g2p (default-schwa short vowels) is phonemizeWordRules; the shipped phonemizeWord adds the kaikki
// short-vowel restoration lexicon. The rule tests below exercise the g2p, so they use phonemizeWordRules.
import {
    phonemizeWord as phonemizeWordShipped,
    phonemizeWordRules as phonemizeWord,
} from "../src/languages/sindhi/sindhi.ts";

// Canonical-IPA goldens for Sindhi (sd) — Perso-Arabic ABJAD, Indo-Aryan. The signature is the four-way IMPLOSIVE
// series ٻ→ɓ, ڏ→ɗ, ڄ→ʄ, ڳ→ɠ (a census gap) + the retroflex series ٽ ٺ ڊ ڍ ڻ ڙ + aspiration (ڀ bʰ, ٿ t̪ʰ,
// جھ d͡ʒʰ, لھ lʰ). SHORT vowels are unwritten → a default [ə] (the abjad wall). See docs/investigations/sd_native_bringup_investigation.md.
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

// SHORT-VOWEL restoration (shipped): the kaikki lexicon supplies the vowels the abjad leaves unwritten. This gold
// is the 2-SOURCE-VERIFIED subset — words where kaikki (Wiktionary/standard, our root) AND an INDEPENDENT source,
// Nihalani's *The Phonetics of Sindhi* (1974), AGREE on the short vowels (7/9 same-word overlap = 78%; the 2
// disagreements — سالو aː~aɪ, ميز ɛ~e — are documented variety variation). Independently corroborated → this test
// can genuinely fail (unlike a kaikki-vs-kaikki+wikipron check, which is circular). See the sd investigation doc.
describe("Sindhi short-vowel restoration — 2-source-verified (kaikki ∩ Nihalani 1974)", () => {
    for (const [word, ipa] of [
        ["اسي", "əsi"], // eighty
        ["ٻيلو", "ɓeːloː"], // forest (implosive ɓ + Nihalani's short vowels)
        ["ڳرو", "ɠəro"], // heavy (implosive ɠ)
        ["انب", "əmb"], // mango
        ["نالو", "naːloː"], // name
        ["رات", "raːt̪ɪ"], // night
        ["صوف", "suːfə"], // wool
    ] as const) {
        test(`${word} → ${ipa}`, () => {
            expect(phonemizeWordShipped(word)).toBe(ipa);
        });
    }
});

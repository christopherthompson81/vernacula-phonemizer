import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/bhojpuri/bhojpuri.ts";

// Canonical-IPA goldens for Bhojpuri (bho) — Indo-Aryan, Devanagari. Anchored on "A Grammar of Bhojpuri"
// (dissertation, Shukla-tradition), whose word→IPA examples were g2p-mined as a falsifiable reference.
// ⚠ BHOJPURI IS NOT A HINDI CLONE, and the three places it differs are the ones a Hindi-shaped engine gets
// wrong: an 8-vowel /i e ɛ a ʌ ɔ o u/ system with NO phonemic length (0 length marks in 1623 mined pairs);
// ⟨ऐ⟩→[ɛ] and ⟨औ⟩→[ɔ] are MONOPHTHONGS, not diphthongs; and only /s ɦ/ fricatives (श/ष→s), with ⟨व⟩→[w]
// (not Hindi ʋ) and ⟨ण ञ⟩→[n].
describe("Bhojpuri canonical IPA — from the reference grammar", () => {
    test("⟨ऐ⟩→ɛ, ⟨औ⟩→ɔ (MONOPHTHONGS, not diphthongs); no vowel length", () => {
        expect(phonemizeWord("बैल")).toBe("bˈɛl"); // 'ox' — ऐ → ɛ monophthong, NOT [ai]
        expect(phonemizeWord("कौन")).toBe("kˈɔn"); // 'who' — औ → ɔ monophthong, NOT [au]
        expect(phonemizeWord("किताब")).toBe("kˈit̪ɑb"); // 'book' — no length (ई→i, ा→ɑ)
        expect(phonemizeWord("पानी")).toBe("pˈɑni"); // 'water' — no length
    });
    test("reduced inventory: श/ष→s, ⟨व⟩→w, ⟨ण/ञ⟩→n", () => {
        expect(phonemizeWord("देश")).toBe("d̪ˈes"); // श → s (only /s ɦ/ fricatives; Hindi d̪eːʃ)
        expect(phonemizeWord("विशाल")).toBe("wˈisɑl"); // व → w (not Hindi ʋ), श → s
        expect(phonemizeWord("गणेश")).toBe("ɡˈənes"); // ण → n (allophone of /n/), श → s
        expect(phonemizeWord("शहर")).toBe("sˈəɦəɾ"); // श → s, no əɦə-lowering (Hindi ʃɛɦɛɾ)
    });

    // ⚠ THE AVAGRAHA ⟨ऽ⟩ (U+093D) WRITES A RETAINED FINAL VOWEL — a live orthographic mark in Bhojpuri on
    // the imperative/participial forms, not Sanskrit's elision sign. Without it the final schwa deletes as
    // usual, so the pair कर/करऽ is the whole rule. All 31 avagraha forms in the grammar-mined referee keep
    // the vowel; enabling it moved the folded backbone 1133 → 1153/1623. It is read from the SPELLING
    // because g2p drops the character, leaving nothing in the phones to test.
    test("a word-final avagraha ⟨ऽ⟩ retains the vowel the schwa rule would delete", () => {
        expect(phonemizeWord("करऽ")).toBe("kˈəɾə"); // referee kʌrʌ — imperative
        expect(phonemizeWord("कर")).toBe("kˈəɾ"); // the same word WITHOUT it — still deleted
        expect(phonemizeWord("देखऽ")).toBe("d̪ˈekʰə"); // referee dekʰʌ
        expect(phonemizeWord("खइलऽ")).toBe("kʰˈəilə"); // referee kʰʌilʌ — participial
    });
});

describe("Bhojpuri: one rhotic, one symbol", () => {
    test("writes the tap for ऋ/ृ, as it does for र", () => {
        // ऋ and ृ shipped ASCII ⟨r⟩ — IPA's alveolar TRILL, and the only r in a manifest whose
        // `consonants` declare र→ɾ and no trill. कृष्ण read krisn with a trill beside कर kəɾ with a tap.
        // bho and magahi were the only two of eight Devanagari engines doing this.
        expect(phonemize("कृष्ण", "bho")).toBe("kɾˈisn");
        expect(phonemize("ऋषि", "bho")).toBe("ɾˈisi");
        expect(phonemize("वृत्त", "bho")).toBe("wɾˈit̪ː");
        // the tap it already used for र is unchanged, and no ASCII r survives anywhere
        expect(phonemize("कर", "bho")).toBe("kˈəɾ");
        expect(phonemize("कृष्ण ऋषि कर", "bho")).not.toMatch(/r/u);
    });
});

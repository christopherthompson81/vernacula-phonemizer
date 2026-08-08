import { describe, expect, test } from "vitest";

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
});

import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/bhojpuri/bhojpuri.ts";

// Canonical-IPA goldens for Bhojpuri (bho) — Indo-Aryan, Devanagari. REVISED against "A Grammar of Bhojpuri"
// (dissertation, Shukla-tradition), whose word→IPA examples were g2p-mined (1623 pairs) as a falsifiable anchor.
// The grammar CORRECTED the earlier module: Bhojpuri has an 8-vowel /i e ɛ a ʌ ɔ o u/ system with NO phonemic
// length (0/1623 mined length marks), and ⟨ऐ ऐ⟩→[ɛ]/⟨औ⟩→[ɔ] are MONOPHTHONGS (NOT the diphthongs previously
// claimed). Only /s ɦ/ fricatives (श/ष→s), ⟨व⟩→[w] (not Hindi ʋ), ⟨ण ञ⟩→[n]. See docs/investigations/bho_native_bringup_investigation.md.
describe("Bhojpuri canonical IPA — revised from the reference grammar", () => {
    test("the CORRECTIONS: ⟨ऐ⟩→ɛ, ⟨औ⟩→ɔ (MONOPHTHONGS, not diphthongs); no vowel length", () => {
        expect(phonemizeWord("बैल")).toBe("bˈɛl"); // 'ox' — ऐ → ɛ monophthong (was wrongly [ai])
        expect(phonemizeWord("कौन")).toBe("kˈɔn"); // 'who' — औ → ɔ monophthong (was wrongly [au])
        expect(phonemizeWord("किताब")).toBe("kˈit̪ɑb"); // 'book' — no length (ई→i, ा→ɑ)
        expect(phonemizeWord("पानी")).toBe("pɑnˈi"); // 'water' — no length
    });
    test("reduced inventory: श/ष→s, ⟨व⟩→w, ⟨ण/ञ⟩→n", () => {
        expect(phonemizeWord("देश")).toBe("d̪ˈes"); // श → s (only /s ɦ/ fricatives; Hindi d̪eːʃ)
        expect(phonemizeWord("विशाल")).toBe("wˈisɑl"); // व → w (not Hindi ʋ), श → s
        expect(phonemizeWord("गणेश")).toBe("ɡˈənes"); // ण → n (allophone of /n/), श → s
        expect(phonemizeWord("शहर")).toBe("sˈəɦəɾ"); // श → s, no əɦə-lowering (Hindi ʃɛɦɛɾ)
    });
});

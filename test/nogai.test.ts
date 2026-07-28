import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/nogai/nogai.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Nogai / ногай тили (nog) — Kipchak Turkic (Kipchak-Nogai), Cyrillic. A near-deterministic
// grapheme scan: Nogai WRITES the uvulars/velar-nasal as digraphs (къ→q, гъ→ʁ, нъ→ŋ) and the front vowels as
// digraphs (аь→æ, оь→ø, уь→y), so ⟨к г⟩ are always [k ɡ] (no harmony inference, the Bashkir pattern). Referee-
// limited (1 kaikki IPA + coarse ASJP); see docs/investigations/nog_native_bringup_investigation.md.
describe("Nogai (ногай тили) canonical IPA", () => {
    test("the one kaikki attestation + front-vowel digraphs", () => {
        expect(phonemizeWord("туькен")).toBe("tyˈken"); // kaikki /ty.ken/ — ⟨уь⟩→[y], ⟨е⟩ post-consonant→[e]
        expect(phonemizeWord("коьз")).toBe("ˈkøz"); // ⟨оь⟩→[ø] (eye)
        expect(phonemizeWord("муьйиз")).toBe("myˈjiz"); // ⟨уь⟩→[y], ⟨й⟩→[j] (horn)
    });

    test("explicit-uvular digraphs къ/гъ/нъ (no harmony inference — ⟨к г⟩ stay [k ɡ])", () => {
        expect(phonemizeWord("къыз")).toBe("ˈqɯz"); // ⟨къ⟩→[q], ⟨ы⟩→[ɯ] (girl)
        expect(phonemizeWord("гъарув")).toBe("ʁaˈruw"); // ⟨гъ⟩→[ʁ]; ⟨в⟩→[w] coda
        expect(phonemizeWord("янъы")).toBe("jaˈŋɯ"); // ⟨нъ⟩→[ŋ]; ⟨я⟩→[ja] (new)
        expect(phonemizeWord("кан")).toBe("ˈkan"); // plain ⟨к⟩→[k] (NOT [q]) — blood
    });

    test("simple vowels, в→w coda, iotation, final stress", () => {
        expect(phonemizeWord("сув")).toBe("ˈsuw"); // ⟨в⟩→[w] post-vocalic coda (water)
        expect(phonemizeWord("эмшек")).toBe("emˈʃek"); // ⟨ш⟩→[ʃ] (breast)
        expect(phonemizeWord("юлдыз")).toBe("julˈdɯz"); // ⟨ю⟩→[ju], ⟨ы⟩→[ɯ] (star)
        expect(phonemizeWord("эки")).toBe("eˈki"); // final (oxytone) stress (two)
    });

    test("a front-vowel digraph counts as the preceding vowel (coda-в / iotation edge case)", () => {
        // ⟨уь⟩/⟨аь⟩ end in the soft sign ь, so the post-vocalic tests read the emitted VOWEL segment, not the raw
        // prior char: a ⟨в⟩ after a digraph vowel is still a coda [w], and a ⟨е⟩ after one still iotates to [je].
        expect(phonemizeWord("суьв")).toBe("ˈsyw"); // ⟨уь⟩[y] + coda ⟨в⟩→[w] (constructed probe)
        expect(phonemizeWord("аье")).toBe("æˈje"); // ⟨аь⟩[æ] + post-vocalic ⟨е⟩→[je] (constructed probe)
    });

    test("registry wiring", () => {
        expect(getPhonemizer("nog").text("кан").trim()).toBe("ˈkan");
    });
});

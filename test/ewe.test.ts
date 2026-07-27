import { describe, expect, test } from "vitest";

import { createEwe, phonemizeWord } from "../src/languages/ewe/ewe.ts";

// Canonical-IPA goldens for Ewe (ee) — Eʋegbe, a Gbe language (Niger-Congo, Kwa), the Latin-based African alphabet.
// Signatures: labial-velars ⟨gb kp⟩→[ɡ͡b k͡p], the bilabial ⟨ƒ⟩→[ɸ]/⟨ʋ⟩→[β] (vs labiodental f/v), affricates ⟨dz ts⟩,
// ⟨ny⟩→[ɲ], ⟨x⟩→[x]; written nasalization (tilde kept); TONELESS (tone unmarked in the orthography). The two non-obvious
// allophonies (per Jalloh's grammar): ⟨w⟩→[w] before a rounded vowel but [ɰ] before an unrounded one, and ⟨r⟩→[l] in an
// onset cluster (after a consonant) but [r] elsewhere. Referee: kaikki Ewe (249 human, 100% folded). See docs/investigations/ee_native_bringup_investigation.md.
describe("Ewe (Eʋegbe) canonical IPA", () => {
    test("labial-velars, bilabials, affricates, ⟨ny⟩", () => {
        expect(phonemizeWord("Eʋegbe")).toBe("eβeɡ͡be"); // the language name — ⟨ʋ⟩→[β], ⟨gb⟩→[ɡ͡b]
        expect(phonemizeWord("agbe")).toBe("aɡ͡be"); // 'life' — labial-velar ⟨gb⟩
        expect(phonemizeWord("atsiaƒu")).toBe("at͡siaɸu"); // 'sea' — ⟨ts⟩→[t͡s], bilabial ⟨ƒ⟩→[ɸ]
        expect(phonemizeWord("nyɔnu")).toBe("ɲɔnu"); // 'woman' — ⟨ny⟩→[ɲ]
    });

    test("⟨w⟩ rounding allophony ([w]/[ɰ]) and ⟨x⟩, ⟨ɣ⟩", () => {
        expect(phonemizeWord("wɔ")).toBe("wɔ"); // ⟨w⟩ before a ROUNDED vowel → [w]
        expect(phonemizeWord("Xawa")).toBe("xaɰa"); // ⟨x⟩→[x]; ⟨w⟩ before UNROUNDED [a] → [ɰ]
        expect(phonemizeWord("ɣ")).toBe("ɰ"); // ⟨ɣ⟩ → the velar approximant [ɰ]
    });

    test("⟨r⟩→[l] in a cluster; written nasalization; ⟨kp⟩; ⟨ŋ⟩", () => {
        expect(phonemizeWord("adre")).toBe("adle"); // 'seven' — ⟨r⟩ after a consonant → [l]
        expect(phonemizeWord("agbalẽ")).toBe("aɡ͡balẽ"); // 'book' — nasalized ⟨ẽ⟩ kept
        expect(phonemizeWord("fukpekpe")).toBe("fuk͡pek͡pe"); // ⟨kp⟩ labial-velar
        expect(phonemizeWord("ŋusẽ")).toBe("ŋusẽ"); // 'strength' — ⟨ŋ⟩→[ŋ], nasal ⟨ẽ⟩
    });

    test("text() tokenizes NFC precomposed vowels + uppercase Ɖ (public-API path)", () => {
        const ee = createEwe();
        expect(ee.text("agbalẽ".normalize("NFC"))).toBe("aɡ͡balẽ"); // NFC nasal ⟨ẽ⟩ not dropped by the tokenizer
        expect(ee.text("Ɖekawo")).toBe("ɖekawo"); // uppercase ⟨Ɖ⟩ tokenized
    });
});

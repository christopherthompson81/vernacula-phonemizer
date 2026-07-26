import { describe, expect, test } from "vitest";

import { createMaori, phonemizeWord } from "../src/languages/maori/maori.ts";

// Māori (mi) — te reo Māori, Eastern Polynesian, New Zealand (~185k). One of the simplest orthographies in the fleet:
// a near-1:1 phonemic map + the macron = length + two digraphs (⟨wh⟩→ɸ, ⟨ng⟩→ŋ). Strict CV syllables, no glide
// formation. Validated against wikipron mri_latn_broad (1005 human headwords) — 99.8% FOLDED / 100.0% symbol on the
// first pass (the only misses are a non-Māori letter glyph). 🔷 single-source-family. See docs/investigations/mi_native_bringup_investigation.md.
describe("Māori canonical IPA — direct phonemic g2p + macron length + the ⟨wh ng⟩ digraphs", () => {
    const mi = createMaori();

    test("the digraphs: ⟨wh⟩→[ɸ], ⟨ng⟩→[ŋ]", () => {
        expect(phonemizeWord("whenua")).toBe("ɸenua"); // ⟨wh⟩ → ɸ ("land")
        expect(phonemizeWord("whānau")).toBe("ɸaːnau"); // ⟨wh⟩→ɸ, macron ā→aː ("family")
        expect(phonemizeWord("ngā")).toBe("ŋaː"); // ⟨ng⟩ → ŋ, ā→aː (the plural article)
        expect(phonemizeWord("tangata")).toBe("taŋata"); // medial ⟨ng⟩ → ŋ ("person")
    });

    test("the macron = LENGTH; ⟨r⟩→[ɾ] tap; vowel sequences stay separate (no glides)", () => {
        expect(phonemizeWord("Māori")).toBe("maːoɾi"); // macron ā→aː, ⟨r⟩→ɾ
        expect(phonemizeWord("kāinga")).toBe("kaːiŋa"); // ā→aː, ⟨ng⟩→ŋ ("village")
        expect(phonemizeWord("Aotearoa")).toBe("aoteaɾoa"); // every vowel is its own mora (no diphthong merging)
        expect(phonemizeWord("Rotorua")).toBe("ɾotoɾua"); // ⟨r⟩ → ɾ (a place)
    });

    test("the simple consonants + short vowels", () => {
        expect(phonemizeWord("motu")).toBe("motu"); // ("island")
        expect(phonemizeWord("kia")).toBe("kia"); // ("be / let it")
        expect(phonemizeWord("haka")).toBe("haka"); // ("posture dance")
    });

    test("clause assembly", () => {
        expect(mi.text("Kia ora, e te whānau.").trim()).toBe("kia oɾa , e te ɸaːnau .");
    });
});

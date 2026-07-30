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

// Māori cardinal numbers (numbers.ts): the MODERN STANDARD tekau series (tekau mā tahi 11, rua tekau 20 — not the
// older ngahuru decade forms), with the additive particle mā introducing a bare unit digit and kotahi as the
// multiplier "one" before a magnitude (kotahi rau, kotahi mano). Sources cited in maori.jsonc + numbers.ts.
describe("Māori cardinal numbers", () => {
    const mi2 = createMaori();
    const say = (n: number): string => mi2.text(String(n)).trim();

    test("units and the tekau decades", () => {
        expect(say(0)).toBe("koɾe"); // kore
        expect(say(5)).toBe("ɾima"); // rima
        expect(say(20)).toBe("ɾua tekau"); // rua tekau
        expect(say(40)).toBe("ɸaː tekau"); // whā tekau (⟨wh⟩→ɸ, macron = length)
    });

    test("11-99: the additive particle mā (modern tekau mā tahi, not ngahuru)", () => {
        expect(say(11)).toBe("tekau maː tahi"); // tekau mā tahi
        expect(say(25)).toBe("ɾua tekau maː ɾima"); // rua tekau mā rima
        expect(say(99)).toBe("iwa tekau maː iwa"); // iwa tekau mā iwa
    });

    test("rau / mano / miriona — kotahi for a multiplier of 1; mā only before a bare unit", () => {
        expect(say(100)).toBe("kotahi ɾau"); // kotahi rau
        expect(say(101)).toBe("kotahi ɾau maː tahi"); // kotahi rau mā tahi (no tens → mā)
        expect(say(111)).toBe("kotahi ɾau tekau maː tahi"); // kotahi rau tekau mā tahi
        expect(say(555)).toBe("ɾima ɾau ɾima tekau maː ɾima"); // rima rau rima tekau mā rima
        expect(say(1000)).toBe("kotahi mano"); // kotahi mano
        expect(say(12345)).toBe("tekau maː ɾua mano toɾu ɾau ɸaː tekau maː ɾima"); // 12 345
        expect(say(1000000)).toBe("kotahi miɾiona"); // kotahi miriona
        expect(say(1000000000)).toBe("kotahi piɾiona"); // kotahi piriona
    });
});

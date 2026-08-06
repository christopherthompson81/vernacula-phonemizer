import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/sesotho/sesotho.ts";
import { phonemize } from "../src/index.ts";
import { numberToWords } from "../src/languages/sesotho/numbers.ts";

// Canonical-IPA goldens for Sesotho / Southern Sotho (st) — Bantu (Sotho-Tswana), Latin. Authored beyond any usable
// machine referee (kaikki "Sotho" = 3 IPA entries; no wikipron/epitran) from standard Sesotho phonology (Doke &
// Mofokeng); 🔷 single-source. The consonant analysis is ANCHORED by the one clean kaikki attestation
// phuputso→pʰupʼut͡sʼɔ (an EXACT match): EJECTIVE plain stops ⟨p t k⟩→[pʼ tʼ kʼ], ⟨ts⟩→[t͡sʼ], ⟨hl⟩→[ɬ], ⟨h⟩→[ɦ].
// Vowel height is unwritten → mid defaults [ɛ ɔ] (the [ʊ]/[i] raisings are a residual). Tone deferred.
describe("Sesotho canonical IPA — Sotho-Tswana rule g2p", () => {
    test("the kaikki anchor: phuputso → pʰupʼut͡sʼɔ (EXACT) — ejective + aspirate + affricate", () => {
        expect(phonemizeWord("phuputso")).toBe("pʰupʼut͡sʼɔ"); // ph→pʰ, p→pʼ (ejective), ts→t͡sʼ (ejective)
    });
    test("signatures: ⟨hl⟩→ɬ, ⟨h⟩→ɦ, ⟨kg⟩→kχ, ejective ⟨t⟩→tʼ", () => {
        expect(phonemizeWord("lehlohonolo")).toBe("lɛɬɔɦɔnɔlɔ"); // hl→ɬ (voiceless lateral fricative), h→ɦ
        expect(phonemizeWord("kgotso")).toBe("kχɔt͡sʼɔ"); // kg→kχ
        expect(phonemizeWord("ntate")).toBe("ntʼɑtʼɛ"); // ⟨t⟩→tʼ (ejective), ⟨a⟩→ɑ
    });
});

// CARDINAL NUMBERS (st). The compositor emits the CITATION / COUNTING stems for a bare 1–9 (what a Mosotho says
// counting aloud) and Sesotho's own noun-free motso/metso "unit, digit" construction inside compounds — a TTS
// reading a bare integer has no noun for the adjectival 1–5 to agree with. Sources are cited in sesotho.jsonc
// "numbers": Omniglot "Numbers in Southern Sotho" + the Wits Sesotho counting tutorial material.
describe("Sesotho cardinal numbers — citation stems + the motso/metso compound", () => {
    test("units are the bare counting stems", () => {
        expect(numberToWords(0)).toBe("lefeela");
        expect(numberToWords(7)).toBe("supa");
        expect(numberToWords(9)).toBe("robong"); // a RELATIVE verb form — takes no class prefix
    });
    test("teens + 21–99 use the motso/metso dummy noun (attested forms)", () => {
        expect(numberToWords(11)).toBe("leshome le motso o le mong");
        expect(numberToWords(12)).toBe("leshome le metso e mmedi");
        expect(numberToWords(21)).toBe("mashome a mabedi le motso o le mong");
        expect(numberToWords(42)).toBe("mashome a mane le metso e mmedi"); // cl.6 after mashome, cl.4 after metso
    });
    test("hundreds are multiplicative with cl.6 concord", () => {
        expect(numberToWords(100)).toBe("lekgolo");
        expect(numberToWords(300)).toBe("makgolo a mararo");
        expect(numberToWords(555)).toBe("makgolo a mahlano le mashome a mahlano le metso e mehlano");
    });
    test("thousands (cl.7/8) and millions", () => {
        expect(numberToWords(1000)).toBe("sekete");
        expect(numberToWords(2000)).toBe("dikete tse pedi"); // cl.8 "tse" concord
        expect(numberToWords(1000000)).toBe("milione");
        expect(numberToWords(1000000000)).toBe("bilione");
    });
    test("end-to-end through the g2p", () => {
        expect(phonemize("21", "st").trim()).toBe("mɑʃɔmɛ ɑ mɑbɛdi lɛ mɔt͡sʼɔ ɔ lɛ mɔŋ");
        expect(phonemize("1000", "st").trim()).toBe("sɛkʼɛtʼɛ");
    });
});

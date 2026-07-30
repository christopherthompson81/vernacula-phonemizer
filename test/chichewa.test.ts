import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { numberToWords } from "../src/languages/chichewa/numbers.ts";

// Chichewa / Chinyanja (nya) cardinal numbers — Bantu (N31), Latin orthography, composed as TEXT and then run
// through the greedy g2p (so ⟨l/r⟩→ɽ, ⟨nd⟩→ⁿd, ⟨ch⟩→t͡ʃ, ⟨kh⟩→kʰ all show up in the expected IPA).
//
// Sources: Omniglot "Numbers in Chichewa" for the tens (60 = makumi asanu ndi limodzi); Wiktionary for the
// magnitude nouns and their classes (zana cl.5 / mazana cl.6 = hundred; chikwi cl.7 / zikwi cl.8 = thousand).
//
// THE REGRESSION THIS LOCKS DOWN: the tens multiplier must take the CLASS-6 concord of makumi (limodzi, awiri,
// atatu, anayi) while a trailing unit keeps its class-8/10 citation form (chimodzi, ziwiri, …). The old compositor
// used one series for both, so 60 came out as *makumi zisanu ndi chimodzi — byte-identical to 51 — and likewise
// 70=52, 80=53, 90=54. See src/languages/chichewa/numbers.ts.
describe("Chichewa numbers", () => {
    test("units — 6–9 are '5 and N' (class-8/10 citation form)", () => {
        expect(numberToWords(1)).toBe("chimodzi");
        expect(numberToWords(6)).toBe("zisanu ndi chimodzi");
        expect(numberToWords(9)).toBe("zisanu ndi zinayi");
        expect(phonemize("1", "nya")).toBe("t͡ʃimod͡zi");
        expect(phonemize("6", "nya")).toBe("zisanu ⁿdi t͡ʃimod͡zi");
    });

    test("ten and the 21–99 compounds", () => {
        expect(numberToWords(10)).toBe("khumi");
        expect(numberToWords(11)).toBe("khumi ndi chimodzi");
        expect(numberToWords(21)).toBe("makumi awiri ndi chimodzi");
        expect(numberToWords(42)).toBe("makumi anayi ndi ziwiri");
        expect(phonemize("42", "nya")).toBe("makumi anaji ⁿdi ziwiɽi");
    });

    test("the tens above 50 are 'five tens and N tens' — and do NOT collide with 51–54", () => {
        expect(numberToWords(50)).toBe("makumi asanu");
        expect(numberToWords(60)).toBe("makumi asanu ndi limodzi"); // class-6 limodzi = ANOTHER ten
        expect(numberToWords(70)).toBe("makumi asanu ndi awiri");
        expect(numberToWords(80)).toBe("makumi asanu ndi atatu");
        expect(numberToWords(90)).toBe("makumi asanu ndi anayi");
        // the class-8/10 unit series keeps 51–54 distinct from 60–90 (the old bug made these pairs identical)
        expect(numberToWords(51)).toBe("makumi asanu ndi chimodzi");
        expect(numberToWords(52)).toBe("makumi asanu ndi ziwiri");
        expect(numberToWords(61)).toBe("makumi asanu ndi limodzi ndi chimodzi");
        for (const [tens, unit] of [
            [60, 51],
            [70, 52],
            [80, 53],
            [90, 54],
        ] as const)
            expect(numberToWords(tens)).not.toBe(numberToWords(unit));
    });

    test("hundreds — zana (cl.5) vs mazana (cl.6) + class-6 multiplier", () => {
        expect(numberToWords(100)).toBe("zana");
        expect(numberToWords(200)).toBe("mazana awiri");
        expect(numberToWords(555)).toBe("mazana asanu ndi makumi asanu ndi zisanu");
        expect(phonemize("200", "nya")).toBe("mazana awiɽi");
    });

    test("thousands — chikwi (cl.7) vs zikwi (cl.8), whose multiplier IS the zi- series", () => {
        expect(numberToWords(1000)).toBe("chikwi");
        expect(numberToWords(2000)).toBe("zikwi ziwiri");
        expect(numberToWords(12345)).toBe("zikwi khumi ndi ziwiri ndi mazana atatu ndi makumi anayi ndi zisanu");
        expect(phonemize("1000", "nya")).toBe("t͡ʃikwi");
    });

    test("≥10⁶ falls back to digit-by-digit (Chichewa has no well-attested native million)", () => {
        expect(numberToWords(1000000)).toBe("chimodzi ziro ziro ziro ziro ziro ziro");
        expect(numberToWords(0)).toBe("ziro");
    });
});

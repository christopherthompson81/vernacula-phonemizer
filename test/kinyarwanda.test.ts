import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { numberToWords } from "../src/languages/kinyarwanda/numbers.ts";

// Kinyarwanda (rw) cardinal numbers — Bantu (JD61), Latin orthography, composed as TEXT and then run through the
// g2p (hence ⟨r⟩→ɾ, ⟨j⟩→ʒ, ⟨cy⟩→kʲ, ⟨cu⟩→t͡ʃu, ⟨ng⟩→ŋ in the expected IPA).
//
// Sources: languagesandnumbers.com/how-to-count-in-kinyarwanda (kin) for the per-magnitude rule; Omniglot
// "Numbers in Kinyarwanda" + kinyarwanda.mofeko.com/numbers.html agree independently on 20–90 and miriyoni = 10⁶;
// Harvard ELIAS "Grammar: Cardinal and ordinal numbers" for the concord statement (1–7 take class agreement,
// 8/9/10 invariable).
//
// WHAT THIS LOCKS DOWN: each magnitude selects its OWN multiplier series — mirongo takes i- (mirongo itatu),
// magana takes a- (magana abiri), ibihumbi takes bi- (ibihumbi bibiri) — and 20 is the fused makumyabiri.
// The old table had a single bare "makumi" + the citation units, producing *makumi kabiri for 20.
describe("Kinyarwanda numbers", () => {
    test("units + ten (bare-numeral citation form)", () => {
        expect(numberToWords(0)).toBe("zeru");
        expect(numberToWords(1)).toBe("rimwe");
        expect(numberToWords(8)).toBe("umunani"); // invariable
        expect(numberToWords(10)).toBe("icumi");
        expect(phonemize("8", "rw")).toBe("umunani");
    });

    test("tens — mirongo + the i- series; 20 is the fused makumyabiri", () => {
        expect(numberToWords(18)).toBe("icumi na umunani");
        expect(numberToWords(20)).toBe("makumyabiri");
        expect(numberToWords(21)).toBe("makumyabiri na rimwe");
        expect(numberToWords(30)).toBe("mirongo itatu");
        expect(numberToWords(80)).toBe("mirongo inani");
        expect(numberToWords(88)).toBe("mirongo inani na umunani");
        expect(numberToWords(99)).toBe("mirongo icyenda na icyenda");
        expect(phonemize("20", "rw")).toBe("makumʲabiɾi");
        expect(phonemize("80", "rw")).toBe("miɾoŋo inani");
    });

    test("hundreds — ijana / magana + the class-6 a- series", () => {
        expect(numberToWords(100)).toBe("ijana");
        expect(numberToWords(200)).toBe("magana abiri");
        expect(numberToWords(555)).toBe("magana atanu na mirongo itanu na gatanu");
        expect(phonemize("200", "rw")).toBe("maɡana abiɾi");
    });

    test("thousands — igihumbi / ibihumbi + the class-8 bi- series", () => {
        expect(numberToWords(1000)).toBe("igihumbi");
        expect(numberToWords(2000)).toBe("ibihumbi bibiri");
        expect(numberToWords(8000)).toBe("ibihumbi munani");
        // ≥10 thousand: the multiplier reverts to the citation series (deliberate simplification)
        expect(numberToWords(12345)).toBe("ibihumbi icumi na kabiri na magana atatu na mirongo ine na gatanu");
    });

    test("millions — miriyoni; ≥10⁹ falls back to digit-by-digit", () => {
        expect(numberToWords(1000000)).toBe("miriyoni");
        expect(numberToWords(3000000)).toBe("miriyoni gatatu");
        expect(numberToWords(1000001)).toBe("miriyoni na rimwe");
        expect(numberToWords(1000000000)).toBe("rimwe zeru zeru zeru zeru zeru zeru zeru zeru zeru");
        expect(phonemize("1000000", "rw")).toBe("miɾijoni");
    });
});

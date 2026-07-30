import { describe, expect, it } from "vitest";
import { phonemizeWord } from "../src/languages/hausa/hausa.ts";
import { numberToWords } from "../src/languages/hausa/numbers.ts";

describe("Hausa g2p (authored, Boko orthography)", () => {
    it("segmental: implosives, ejectives, palatals, ɸ, n-assimilation", () => {
        expect(phonemizeWord("ɓera")).toBe("ɓˈera"); // implosive ɓ
        expect(phonemizeWord("ɗaya")).toBe("ɗˈa˥ja˥"); // implosive ɗ (+ tone)
        expect(phonemizeWord("ƙasa")).toBe("kʼˈa˥sa˥"); // ejective ƙ→kʼ
        expect(phonemizeWord("hankali")).toBe("ha˥ŋkˈa˩li˩"); // n→ŋ before k
        expect(phonemizeWord("kai")).toBe("kˈaⁱ"); // diphthong ai→aⁱ
        expect(phonemizeWord("sau")).toBe("sˈaᵘ"); // diphthong au→aᵘ
        expect(phonemizeWord("faa")).toBe("ɸˈaː"); // f→ɸ, long aa→aː
    });

    it("penultimate stress", () => {
        expect(phonemizeWord("Najeriya")).toBe("na˩d͡ʒe˥rˈi˥ja˩"); // 4 syll → stress 3rd (penult)
        expect(phonemizeWord("mutum")).toBe("mˈu˩tu˥˩m"); // 2 syll → stress 1st
    });

    it("lexical tone overlay (H ˥ / L ˩ / F ˥˩), out-of-lexicon untoned", () => {
        expect(phonemizeWord("ruwa")).toBe("rˈu˥wa˥"); // HH
        expect(phonemizeWord("uku")).toBe("ˈu˥ku˩"); // HL
        expect(phonemizeWord("sannu")).toBe("sˈannu"); // not in lexicon → no tone marks
    });

    // NUMBERS — Hausa is MAGNITUDE-FIRST (the scale word precedes its multiplier: dubu biyu = 2 000). The chain
    // stopped at dubu and fed the whole quotient to below1000(), which indexes ONES[⌊q/100⌋] — undefined for
    // q ≥ 1000 — so 100 000, 10⁶ and 10⁹ ALL collapsed to the same "dubu ɗari …" output. Scales miliyan (10⁶) and
    // biliyan (10⁹) from Omniglot "Numbers in Hausa"; that page also gives 100 000 as the native "zambar ɗari",
    // i.e. thousand-hundred, which is what "dubu ɗari" is here (dubu being this table's word for thousand).
    it("numbers: units, compounds, hundreds, and the miliyan / biliyan scales", () => {
        expect(numberToWords(7)).toBe("bakwai");
        expect(numberToWords(11)).toBe("goma sha ɗaya");
        expect(numberToWords(42)).toBe("arba'in da biyu"); // tens da unit
        expect(numberToWords(101)).toBe("ɗari da ɗaya");
        expect(numberToWords(555)).toBe("ɗari biyar da hamsin da biyar"); // hundred-five da fifty da five
        expect(numberToWords(12345)).toBe("dubu goma sha biyu da ɗari uku da arba'in da biyar");
        expect(numberToWords(100000)).toBe("dubu ɗari"); // thousand-hundred (was shared with 10⁶ and 10⁹)
        expect(numberToWords(1_000_000)).toBe("miliyan");
        expect(numberToWords(2_000_000)).toBe("miliyan biyu"); // multiplier FOLLOWS the scale word
        expect(numberToWords(1_000_000_000)).toBe("biliyan");
        expect(numberToWords(2_000_000_000)).toBe("biliyan biyu");
    });
});

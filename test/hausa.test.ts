import { describe, expect, it } from "vitest";
import { phonemizeWord } from "../src/languages/hausa/hausa.ts";

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
});

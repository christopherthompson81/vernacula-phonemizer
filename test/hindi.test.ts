import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";

// Canonical-IPA goldens for Hindi (Devanagari abugida). Values captured from the native engine; they are
// byte-identical to the espeak-ng-portable canonical output the engine was lifted from.
describe("hindi canonical IPA", () => {
    test.each([
        ["भारत", "bʱˈaːɾət̪"], // schwa retained medially (VCəCV blocked by final त̪)
        ["नमस्ते", "nəmˈəst̪eː"],
        ["सरकार", "səɾkˈaːɾ"], // final-superheavy stress
        ["चाय", "t͡ʃˈaːj"],
        ["हम", "ɦˈəm"],
        ["बड़ा", "bˈəɽaː"], // nukta ड़ → retroflex flap
        ["झूठ", "d͡ʒʱˈuːʈʰ"], // breathy + retroflex aspirated
        ["अगरबत्ती", "əɡˈəɾbət̪ːiː"], // geminate blocks schwa deletion
        ["कांग्रेस", "kaː̃ŋɡɾˈeːs"], // anusvara → nasal vowel + homorganic ŋ
        ["यहाँ", "jˈəɦaː̃"],
    ])("%s → %s", (input, expected) => {
        expect(phonemize(input, "hi")).toBe(expected);
    });

    test("numbers (Indian grouping + decimal + percent + rupee strip)", () => {
        expect(phonemize("२०२४", "hi")).toBe("d̪ˈoː ɦəzˈaːɾ t͡ʃɔːbˈiːs");
        expect(phonemize("१२.५", "hi")).toBe("bˈaːɾəɦ d̪əʃˈəmləʋ pˈaː̃t͡ʃ");
        expect(phonemize("५०%", "hi")).toBe("pət͡ʃˈaːs pɾˈət̪ɪʃət̪");
        expect(phonemize("₹५००", "hi")).toBe("pˈaː̃t͡ʃ sˈɔː");
    });

    test("clause punctuation → inline pause marks", () => {
        expect(phonemize("भारत। नमस्ते।", "hi")).toBe("bʱˈaːɾət̪ . nəmˈəst̪eː .");
    });
});

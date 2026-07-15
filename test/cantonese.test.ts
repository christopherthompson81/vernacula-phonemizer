import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/cantonese/cantonese.ts";

// Canonical-IPA goldens for Cantonese / Yue (yue). Han → Jyutping (rime-cantonese dict) → IPA: initial + final
// (phonemic aː/ɐ length, checked -p̚/-t̚/-k̚ codas) + one of the six tones as Chao contour letters
// (1˥ 2˧˥ 3˧ 4˨˩ 5˩˧ 6˨). Polyphones resolve by word. See docs/yue_native_bringup_investigation.md.
describe("cantonese canonical IPA", () => {
    test("Han → IPA (tones, aː/ɐ length, checked codas, polyphones)", () => {
        expect(phonemizeWord("香港")).toBe("hœːŋ˥ kɔːŋ˧˥"); // hoeng1 gong2 'Hong Kong'
        expect(phonemizeWord("食飯")).toBe("sɪk̚˨ faːn˨"); // sik6 faan6 'eat': checked coda k̚
        expect(phonemizeWord("廣東話")).toBe("kʷɔːŋ˧˥ tʊŋ˥ waː˧˥"); // 'Cantonese': labio-velar kʷ
        expect(phonemizeWord("唔該")).toBe("m̩˨˩ kɔːi˥"); // m4 goi1: syllabic nasal m̩
        expect(phonemizeWord("銀行")).toBe("ŋɐn˨˩ hɔːŋ˨˩"); // 'bank': 行→hong4
        expect(phonemizeWord("行路")).toBe("haːŋ˨˩ lou˨"); // 'walk': 行→haang4 (polyphone by word)
    });

    test("direct Jyutping input", () => {
        expect(phonemizeWord("nei5 hou2")).toBe("nei˩˧ hou˧˥"); // 你好
    });

    test("numbers (Han-numeral composition)", () => {
        expect(phonemize("21", "yue")).toBe("jiː˨ sɐp̚˨ jɐt̚˥"); // 二十一
    });
});

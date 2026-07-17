import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/hakka/hakka.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Hakka Chinese / 客家话 (hak), Meixian 梅县 dialect — a distinct Sinitic branch. The
// signature is the retention of ALL THREE Middle Chinese stop codas -p̚ -t̚ -k̚ (十→səp̚, 月→ŋiat̚, 六→liʊk̚) that
// separates Hakka from Jin (merged -ʔ) and Mandarin (lost). Six citation tones as Chao contour letters (陰平 ˦˦,
// 陽平 ˩˩, 上 ˧˩, 去 ˥˧, 陰入 ˩, 陽入 ˥). Readings from Wiktionary/kaikki Meixian Sinological-IPA. See
// docs/hakka_native_bringup_investigation.md.
describe("Hakka Chinese (Meixian) canonical IPA", () => {
    test("single characters — tones as Chao letters", () => {
        expect(phonemizeWord("馬")).toBe("ma˦˦"); // 陰平 44
        expect(phonemizeWord("犬")).toBe("kʰian˧˩"); // 上 31
        expect(phonemizeWord("人")).toBe("ŋin˩˩"); // 陽平 11
    });

    test("the retained -p̚ -t̚ -k̚ stop codas (the Hakka signature)", () => {
        expect(phonemizeWord("十")).toBe("səp̚˥"); // -p̚, 陽入 5
        expect(phonemizeWord("月")).toBe("ŋiat̚˥"); // -t̚, 陽入 5
        expect(phonemizeWord("六")).toBe("liʊk̚˩"); // -k̚, 陰入 1
        expect(phonemizeWord("客")).toBe("hak̚˩"); // -k̚, 陰入 1 — the ethnonym 客家's first syllable
    });

    test("multi-char words carry baked tone sandhi (surface tone after ⁻)", () => {
        expect(phonemizeWord("中國")).toBe("t͡sʊŋ˧˥ kuɛt̚˩"); // 中 44→35 sandhi before a checked syllable
        expect(phonemizeWord("客家")).toBe("hak̚˩ ka˦˦"); // the Hakka endonym
    });

    test("simplified input resolves (via OpenCC aliases)", () => {
        expect(phonemizeWord("中国")).toBe(phonemizeWord("中國"));
        expect(phonemizeWord("太阳")).toBe("tʰaɪ˥˧ iɔŋ˩˩");
    });

    test("numbers compose through the Han numeral system", () => {
        // 25 → 二十五 → ŋi˥˧ səp̚˥ n̩˧˩
        expect(getPhonemizer("hak").text("25").trim()).toBe("ŋi˥˧ səp̚˥ n̩˧˩");
    });
});

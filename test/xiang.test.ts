import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/xiang/xiang.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Xiang Chinese / 湘语 (hsn), Changsha 长沙 (New Xiang) dialect — a distinct Sinitic
// branch. Its signature within the Sinitic set: it retains the Middle Chinese 入声 (entering) TONE (Chao 24) but
// LOST the checked stop coda entirely — no -p̚/-t̚/-k̚ (Hakka keeps) and no -ʔ (Jin keeps): 十→sz̩˨˦, 月→y̯e̞˨˦ end
// in a bare vowel/nasal. Six tones as Chao letters (陰平 ˧˧, 陽平 ˩˧, 上 ˦˩, 陰去 ˦˥, 陽去 ˨˩, 入 ˨˦). Readings from
// Wiktionary/kaikki Changsha Sinological-IPA (narrow vowel diacritics kept verbatim). See docs/investigations/hsn_native_bringup_investigation.md.
describe("Xiang Chinese (Changsha) canonical IPA", () => {
    test("single characters — tones as Chao letters", () => {
        expect(phonemizeWord("馬")).toBe("ma̠˦˩"); // 上 41
        expect(phonemizeWord("人")).toBe("ʐən˩˧"); // 陽平 13
    });

    test("入声 survives as a TONE (24) but the checked coda is GONE (the Xiang signature)", () => {
        expect(phonemizeWord("十")).toBe("sz̩˨˦"); // no -p̚ (cf. Hakka səp̚˥) — bare syllabic z̩
        expect(phonemizeWord("月")).toBe("y̯e̞˨˦"); // no -t̚ (cf. Hakka ŋiat̚˥) — bare vowel
    });

    test("multi-char words + the dialect's home 長沙 (Changsha)", () => {
        expect(phonemizeWord("長沙")).toBe("t͡san˩˧ sa̠˧˧");
        expect(phonemizeWord("中國")).toBe("t͡sən˧˧ ku̯ɤ̞˨˦");
    });

    test("simplified input resolves (via OpenCC aliases)", () => {
        expect(phonemizeWord("长沙")).toBe(phonemizeWord("長沙"));
    });

    test("numbers compose through the Han numeral system", () => {
        expect(getPhonemizer("hsn").text("100").trim()).toBe("i˨˦ pɤ̞˨˦"); // 一百
    });
});

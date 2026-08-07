import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/gan/gan.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Gan Chinese / 贛語 (gan), Nanchang 南昌 dialect — a distinct Sinitic branch
// (Jiangxi). Its signature within the Sinitic set: it retains the Middle Chinese 入声 (entering)
// tones with TWO CHECKED STOP CODAS — -t̚ (from MC -p/-t) and -ʔ (from MC -k) — where Hakka keeps all three
// -p̚/-t̚/-k̚, Jin keeps only -ʔ, and Xiang lost the coda entirely. Nasal codas are -n/-ŋ (MC -m merged to -n), and
// Nanchang shows the n→l initial merger (南→lan). Readings from Wiktionary/kaikki Nanchang Sinological-IPA (narrow
// diacritics kept verbatim).
describe("Gan Chinese (Nanchang) canonical IPA", () => {
    test("single characters — tones as Chao letters", () => {
        expect(phonemizeWord("馬")).toBe("ma˨˩˧"); // 上 213
        expect(phonemizeWord("人")).toBe("n̠ʲin˧˥"); // 陽平 35
    });

    test("入声 survives with TWO checked codas -t̚ and -ʔ (the Gan signature)", () => {
        expect(phonemizeWord("十")).toBe("sɨt̚˨"); // MC -p → -t̚ (cf. Hakka səp̚˥, Xiang coda-less sz̩˨˦)
        expect(phonemizeWord("學")).toBe("hɔʔ˨"); // MC -k → -ʔ (cf. Hakka hɔk̚)
        expect(phonemizeWord("月")).toBe("n̠ʲyɵt̚˨"); // -t̚
    });

    test("multi-char words + the dialect's home 南昌 (Nanchang)", () => {
        expect(phonemizeWord("南昌")).toBe("lan˧˥ t͡sʰɔŋ˦˨"); // 南→lan (n→l initial merger)
        expect(phonemizeWord("中國")).toBe("t͡suŋ˦˨ kuɛt̚˥");
    });

    test("simplified aliases resolve to the same reading (OpenCC TSCharacters)", () => {
        expect(phonemizeWord("中国")).toBe(phonemizeWord("中國"));
    });

    test("full text via the registry (Han numerals + punctuation)", () => {
        expect(getPhonemizer("gan").text("我食飯。")).toBeTruthy();
    });
});

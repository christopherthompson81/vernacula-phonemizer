import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/jin/jin.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Jin Chinese / 晋语 (cjy), Taiyuan 太原 dialect — a distinct Sinitic branch. The
// signature is the retained 入声/checked coda -ʔ (月→yəʔ, 十→səʔ) that separates Jin from Mandarin, plus the
// five-tone system rendered as Chao contour letters (平 ˩˩, 上 ˥˧, 去 ˦˥, 阴入 ˨, 阳入 ˥˦). Readings are from
// Wiktionary/kaikki Taiyuan Sinological-IPA.
describe("Jin Chinese (Taiyuan) canonical IPA", () => {
    test("single characters — tones as Chao letters", () => {
        expect(phonemizeWord("馬")).toBe("ma˥˧"); // 上声 53
        expect(phonemizeWord("犬")).toBe("t͡ɕʰye˩˩"); // 平声 11
        expect(phonemizeWord("人")).toBe("ʐəŋ˩˩");
    });

    test("the 入声/checked coda -ʔ (the Jin signature)", () => {
        expect(phonemizeWord("月")).toBe("yəʔ˨"); // 阴入 2, glottal-stop coda
        expect(phonemizeWord("十")).toBe("səʔ˥˦"); // 阳入 54, glottal-stop coda
    });

    test("multi-char words carry baked tone sandhi (surface tone after ⁻)", () => {
        expect(phonemizeWord("九十")).toBe("t͡ɕiəu˩˩ səʔ˥˦"); // 九 53→11 (sandhi) before 十
        expect(phonemizeWord("太原")).toBe("tʰai˦˥ ye˩˩"); // Taiyuan, the dialect's home
    });

    test("simplified input resolves (via OpenCC aliases)", () => {
        expect(phonemizeWord("中国")).toBe(phonemizeWord("中國"));
        expect(phonemizeWord("电话")).toBe("tie˦˥ xua˦˥");
    });

    test("numbers compose through the Han numeral system", () => {
        // 25 → 二十五 → əɻ˦˥ səʔ˥˦ vu˥˧
        expect(getPhonemizer("cjy").text("25").trim()).toBe("əɻ˦˥ səʔ˥˦ vu˥˧");
    });

    test("clause punctuation becomes a pause", () => {
        expect(getPhonemizer("cjy").text("馬。").trim()).toBe("ma˥˧ .");
    });
});

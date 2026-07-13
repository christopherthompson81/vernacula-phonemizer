import { describe, expect, it } from "vitest";
import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/korean/korean.ts";

describe("Korean Hangul g2p + sandhi", () => {
    it("core words + coda neutralisation (unreleased ̚)", () => {
        expect(phonemizeWord("한국")).toBe("hˈɐnɡuk̚"); // ㄱ→ɡ after nasal; coda ㄱ→k̚
        expect(phonemizeWord("밥")).toBe("pˈɐp̚"); // coda ㅂ→p̚ unreleased
        expect(phonemizeWord("꽃")).toBe("k͈ˈot̚"); // ㄲ tense onset; ㅊ coda→t̚
        expect(phonemizeWord("값")).toBe("kˈɐp̚"); // ㅄ cluster coda→p̚
        expect(phonemizeWord("서울")).toBe("sɘˈuɭ"); // stress on the heavy 2nd syllable; ㄹ coda→ɭ
    });

    it("cross-syllable sandhi", () => {
        expect(phonemizeWord("가다")).toBe("kˈɐdɐ"); // lenis ㄷ voices intervocalically → d
        expect(phonemizeWord("학교")).toBe("hˈɐk̚k͈jo"); // tensification: k̚ + ㄱ → k͈
        expect(phonemizeWord("국물")).toBe("kˈuŋmuɭ"); // nasalization: ㄱ before ㅁ → ŋ
        expect(phonemizeWord("독립")).toBe("tˈoŋnip̚"); // ㄱ→ŋ, ㄹ→n
        expect(phonemizeWord("신라")).toBe("sˈiɭɭɐ"); // lateralization: ㄴㄹ → ll
        expect(phonemizeWord("좋다")).toBe("t͡ɕˈotʰɐ"); // aspiration: ㅎ + ㄷ → tʰ
        expect(phonemizeWord("놓고")).toBe("nˈokʰo"); // aspiration: ㅎ + ㄱ → kʰ
        expect(phonemizeWord("국이")).toBe("kˈuɡi"); // liaison + voicing: ㄱ → onset ɡ
        expect(phonemizeWord("같이")).toBe("kˈɐt͡ɕʰi"); // liaison + palatalization: ㅌ+이 → t͡ɕʰ
    });

    it("stress = first heavy (closed) syllable, else first", () => {
        expect(phonemizeWord("사람")).toBe("sɐɾˈɐm"); // open + closed → stress 2nd
        expect(phonemizeWord("하나")).toBe("hˈɐnɐ"); // open + open → stress 1st
    });

    it("lexical tensification (경음화) — Sino-Korean §26 / loanword, native stays lenis", () => {
        expect(phonemizeWord("갈등")).toBe("kˈɐɭt͈ɯŋ"); // Sino-Korean ㄹ+ㄷ → tense
        expect(phonemizeWord("물질")).toBe("mˈuɭt͡ɕ͈iɭ"); // ㄹ+ㅈ → tense
        expect(phonemizeWord("알다")).toBe("ˈɐɭdɐ"); // native ㄹ+ㄷ → stays LENIS (no over-tensing)
    });

    it("numbers (Sino-Korean)", () => {
        expect(phonemize("10", "ko")).toBe("sˈip̚");
        expect(phonemize("100", "ko")).toBe("p͈ˈɛk̚"); // 백 is lexically tense (loanword-initial 경음화)
    });
});

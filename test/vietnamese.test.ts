import { describe, expect, it, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/vietnamese/vietnamese.ts";

describe("Vietnamese g2p (Northern)", () => {
    it("the 6 tones (Chao contours after the nucleus)", () => {
        expect(phonemizeWord("ma")).toBe("mˈaː˧"); // ngang (level)
        expect(phonemizeWord("mà")).toBe("mˈaː˨˩"); // huyền (low falling)
        expect(phonemizeWord("má")).toBe("mˈaː˧˥"); // sắc (high rising)
        expect(phonemizeWord("mả")).toBe("mˈaː˧˩˧"); // hỏi (dipping)
        expect(phonemizeWord("mã")).toBe("mˈaː˧ˀ˥"); // ngã (creaky rising)
        expect(phonemizeWord("mạ")).toBe("mˈaː˨˩ˀ"); // nặng (heavy/glottal)
    });

    it("onsets, rhymes, tone placement", () => {
        const cases: [string, string][] = [
            ["xin", "sˈi˧n"],
            ["chào", "t͡ɕˈaː˨˩w"], // ch → t͡ɕ, ào → aː + tone + w glide
            ["Việt", "vˈiɛ˨˩ˀt̪"], // iê → iɛ, nặng, dental t̪
            ["một", "mˈo˨˩ˀt̪"],
            ["người", "ŋˈɨə˨˩j"], // ng → ŋ, ươi → ɨə + j
            ["nước", "nˈɨə˧˥k"],
            ["đi", "ɗˈi˧"], // đ → implosive ɗ
            ["biết", "bˈiɛ˧˥t̪"],
            ["quả", "kwˈaː˧˩˧"], // qu → kw glide
            ["giết", "zˈiɛ˧˥t̪"], // gi → z, the i rejoins the iê diphthong
            ["anh", "ʔˈe˧ɲ"], // vowel-initial → ʔ; a → e before palatal nh; ngang tone ˧
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    it("numbers (Northern)", () => {
        expect(phonemize("5", "vi")).toBe("nˈa˧m");
        expect(phonemize("25", "vi")).toBe("hˈaː˧j mˈɨə˧j lˈa˧m"); // 5-after-ten → lăm
        expect(phonemize("21", "vi")).toBe("hˈaː˧j mˈɨə˧j mˈo˧˥t̪"); // 1-after-ten → mốt
    });
});

// Foreign proper nouns are code-switched constantly in Vietnamese text; a token that is not a valid
// Vietnamese syllable used to phonemize to "" and vanish (paris sofia → nothing, Run 28). Now routed
// through the English phonemizer — a missing word is worse than an English-phoneme one.
describe("Vietnamese: foreign tokens are not dropped", () => {
    test("invalid syllables route through foreign", () => {
        const ipa = phonemize("tại paris và sofia", "vi");
        expect(ipa.split(" ").length).toBe(4);
        expect(ipa).toContain("pʰˈɛɹɪs");
    });

    test("native syllables and numbers unaffected", () => {
        expect(phonemize("có 25 người", "vi")).toBe("kˈɔ˧˥ hˈaː˧j mˈɨə˧j lˈa˧m ŋˈɨə˨˩j");
    });
});

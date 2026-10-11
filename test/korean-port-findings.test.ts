/**
 * Korean defects the Rust port found by reading (#1511), fixed TS-first. Expected strings are the fixed
 * engine's own output, not hand-typed IPA; the tensification cases assert a relation to the bare key.
 */
import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/korean/g2p.ts";
import { normalizeKorean } from "../src/languages/korean/normalize.ts";
import { spellDigits } from "../src/languages/korean/numbers.ts";

describe("Korean: °F takes the °C guard, so a glued particle keeps 화씨", () => {
    test("70°F에서 and a signed one", () => {
        expect(normalizeKorean("70°F에서")).toBe("화씨 칠십도에서");
        expect(normalizeKorean("-5°F에")).toBe("화씨 마이너스 오도에");
        expect(normalizeKorean("70°F 정도")).toBe("화씨 칠십도 정도");
    });
});

describe("Korean: a decimal's integer part past 2^53 falls back to its digits", () => {
    test("the integer part is spelled, not deleted", () => {
        expect(normalizeKorean("99999999999999999999.5")).toBe(`${spellDigits("99999999999999999999")}점오`);
        expect(normalizeKorean("12345678901234567890.25배")).toBe(`${spellDigits("12345678901234567890")}점이오배`);
        expect(normalizeKorean("3.5")).toBe("삼점오");
    });
});

describe("Korean: a relational operand is a whole eojeol", () => {
    test("a counter glued to the right operand stays with it, and keeps its own series", () => {
        expect(normalizeKorean("값=3원")).toBe("값은 삼원과 같다");
        expect(normalizeKorean("x=3개")).toBe("엑스는 세개와 같다");
        expect(normalizeKorean("a<5명")).toBe("에이는 다섯명보다 작다");
        // The left side was already right and is unchanged.
        expect(normalizeKorean("3원=값")).toBe("삼원은 값과 같다");
        expect(normalizeKorean("x = 3")).toBe("엑스는 삼과 같다");
    });

    test("a lone Latin letter is not taken out of a longer word", () => {
        expect(normalizeKorean("xy = z")).toBe("xy = z");
        expect(normalizeKorean("ab < c")).toBe("ab < c");
        expect(normalizeKorean("x = zebra")).toBe("x = zebra");
        expect(normalizeKorean("x = y")).toBe("엑스는 와이와 같다");
    });
});

describe("Korean: lexical tensification reaches a key that carries particles", () => {
    test("가능성 + a particle chain keeps the key's tense onset", () => {
        const bare = phonemizeWord("가능성");
        expect(bare).toContain("s͈");
        for (const w of ["가능성이", "가능성은", "가능성에서는"]) expect(phonemizeWord(w).startsWith(bare)).toBe(true);
    });

    test("not after a one-syllable key, and not before a non-particle", () => {
        expect(phonemizeWord("신")).toContain("͈");
        expect(phonemizeWord("신을")).not.toContain("͈");
        expect(phonemizeWord("가운")).toContain("͈");
        expect(phonemizeWord("가운데")).not.toContain("͈");
    });
});

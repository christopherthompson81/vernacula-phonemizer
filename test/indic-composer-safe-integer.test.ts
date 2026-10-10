/**
 * The shared Indic composer refuses an unsafe integer (#1463). `indicNumberWords` recursed on `Infinity`
 * (a 309+-digit run) until the stack overflowed, and composed the rounded float above 2^53, so every ordinal
 * or marker rule built on it misread `9007199254740993` as …992 or threw a RangeError out of `phonemize`.
 * It now returns a gap (`[null]`), the rules decline, and the number path spells the digits.
 *
 * Expectations are relational (derived from the engine itself), never hand-typed IPA.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { indicNumberWords } from "../src/core/numbers.ts";
import { MANIFEST as HI } from "../src/languages/hindi/manifest.ts";

describe("indicNumberWords refuses an unsafe integer", () => {
    test.each([2 ** 53, 2 ** 53 + 2, 1e21, Infinity, -Infinity, NaN, 1.5])("%s is a gap", (n) => {
        expect(indicNumberWords(n, HI.numbers)).toEqual([null]);
    });
    test("the largest safe integer still composes", () => {
        const w = indicNumberWords(Number.MAX_SAFE_INTEGER, HI.numbers);
        expect(w.length).toBeGreaterThan(1);
        expect(w).not.toContain(null);
    });
});

/** [language, the ordinal or number marker its normalizer composes a cardinal for]. */
const MARKERS: [string, string][] = [
    ["pa", "ਵਾਂ"], ["ur", "واں"], ["or", "ତମ"], ["bn", "তম"], ["as", "নং"], ["as", "তম"],
    ["hi", "वाँ"], ["mr", "वा"],
];

describe.each(MARKERS)("%s, marker %s: the digits are spelled", (lang, marker) => {
    const p = (s: string): string => phonemize(s, lang);
    test("2^53+1 reads its own digits, not 2^53's", () => {
        const above = p(`9007199254740993${marker}`);
        expect(above).not.toBe(p(`9007199254740992${marker}`));
        expect(above).toBe(`${p("9007199254740993")} ${p(marker)}`);
        expect(above).not.toMatch(/\d/u);
    });
    test("a 400-digit run does not throw", () => {
        const digits = "1".repeat(400);
        const out = p(`${digits}${marker}`);
        expect(out).toBe(`${p(digits)} ${p(marker)}`);
        expect(out).not.toMatch(/\d/u);
    });
});

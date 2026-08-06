/**
 * The counting helper — pinned against the three measurements it exists to prevent.
 *
 * Each test reproduces a real wrong answer from the Khmer work, so a regression here is a regression to a defect
 * that already shipped a wrong conclusion once.
 */
import { describe, expect, test } from "vitest";

import { DIGIT, digitFlanked, leading, literal, matches, wordAndSubstring } from "./count.ts";

describe("literal escaping", () => {
    test("⚠ a sign that is a metacharacter means ITSELF", () => {
        // `grep -cE "\$sg"` expanded `<` to `\<` — an ERE WORD BOUNDARY — and reported 1,023 digit-flanked `<`
        // in a corpus containing zero. The whole `less-than` class was declared present on that number.
        expect(digitFlanked("៣<៥ និង ៤ < ៦", "<").length).toBe(2);
        expect(digitFlanked("អក្សរ < អក្សរ", "<").length).toBe(0);   // letters, not digits → not an operator
        for (const meta of ["+", ".", "*", "?", "(", "[", "-", "^", "$"])
            expect(() => new RegExp(literal(meta), "u"), meta).not.toThrow();
    });
});

describe("digit classes", () => {
    test("⚠ NATIVE digits count — the whole point", () => {
        // `\d` is ASCII-only even under /u. Khmer digits are 74% of its corpus numerals.
        expect(new RegExp(DIGIT, "u").test("៥")).toBe(true);
        expect(digitFlanked("៥+៣", "+").length).toBe(1);
        expect(digitFlanked("5+3", "+").length).toBe(1);
        expect(digitFlanked("១៨៣០ ± ៤០", "±").length).toBe(1);   // separator-tolerant
    });
});

describe("leading", () => {
    test("⚠ a digit-PRECEDED sign is not leading, whatever the whitespace", () => {
        // `(?<![0-9])\s*±` lets the match start after the space, where the lookbehind sees the space instead of the
        // digit — so `25,559 ± 4` counted as leading. 23 "leading" ± became 4 once measured properly.
        expect(leading("25,559 ± 4", "±").length).toBe(0);
        expect(leading("១៨៣០ ±៤០", "±").length).toBe(0);
        expect(leading("±២០ ដឺក្រេ", "±").length).toBe(1);        // genuinely leading
        expect(leading("រយៈទទឹង ±60°", "±").length).toBe(1);      // after a word, still leading
    });
});

describe("wordAndSubstring", () => {
    test("⚠ a word buried inside other words is not attested", () => {
        // យ័ន: 543 occurrences, 7 as a whole word, the rest inside បាយ័ន / អារ្យ័ន. Declared a currency word on the
        // larger number. The ratio is the only warning a spaceless script offers.
        const corpus = "បាយ័ន អារ្យ័ន បាយ័ន យ័ន បាយ័ន";
        const r = wordAndSubstring(corpus, "យ័ន");
        expect(r.anywhere).toBe(5);
        expect(r.whole).toBe(1);
        expect(r.ratio).toBeLessThan(0.3);
    });

    test("a genuinely standalone word scores a high ratio", () => {
        const r = wordAndSubstring("ស្មើ គឺ ស្មើ ហើយ ស្មើ", "ស្មើ");
        expect(r.whole).toBe(3);
        expect(r.ratio).toBe(1);
    });
});

describe("matches returns instances, not a number", () => {
    test("⚠ the count is .length, so the caller has the instances in hand", () => {
        // "A count is a lead, never a finding — read the instances" (playbook). The API cannot enforce reading
        // them, but it can refuse to hand over a bare number.
        const ms = matches("៥+៣ និង ៨+២", "\\+");
        expect(ms.length).toBe(2);
        expect(ms[0]).toHaveProperty("index");
        expect(ms[0]!.text).toBe("+");
    });
});

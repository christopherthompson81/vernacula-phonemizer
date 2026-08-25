/**
 * U+2212 is read; the ASCII hyphen is still refused.
 *
 * ⚠ THE REFUSAL WAS NEVER ABOUT THE WORD. Marathi declines a hyphen-before-digit rule because the trigger
 * is ambiguous — Devanagari compounds are hyphenated (आस-पास) and `चंद्रयान -1` is a spacecraft
 * designation — so no choice of word unlocks it. U+2212 MINUS SIGN carries none of that: it is never a
 * compound hyphen, never a designation dash, and not in the range rule's `[-–—]` class either.
 *
 * Until now it was simply DROPPED, so `−२५°C` read *पंचवीस अंश सेल्सिअस* — a negative temperature with the
 * sign silently gone. That is the one reading here that was wrong rather than merely absent.
 *
 * ⚠ ZERO CORPUS OCCURRENCES. U+2212 appears 0 times in the mined artifact and 0 times in the golden, so
 * this rule is a gap fill, not a measured fix. These assertions are the only thing watching it.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { DEF } from "../src/languages/marathi/marathi.ts";

const say = (s: string): string => phonemize(s, "mr");

describe("marathi reads U+2212 and still refuses the hyphen", () => {
    const minus = say(DEF.symbolWords.minus);

    test("a signed quantity keeps its sign", () => {
        expect(say("−२५°C")).toContain(minus);
        expect(say("−२५°C")).toContain(say(DEF.degree.celsius));
        expect(say("−0.5")).toContain(minus);
    });

    /**
     * ⚠ SPACING DECIDES IT BETWEEN TWO NUMBERS, and that is corpus evidence rather than a convention I
     * picked. Reading the 279 U+2212 instances across the mined artifacts instead of counting them: the
     * UNSPACED digit−digit form is a RANGE — a lifespan `Liliʻuokalani (1838−1917)`, a page span `41−49`,
     * scientific notation `1.602×10−19` — while the SPACED form is arithmetic, as Scottish Gaelic writes
     * it: `(22 − 14) + (−7)`. So an unspaced pair goes back to silence, which is the right answer when
     * the alternative is reading a lifespan as a subtraction.
     */
    test("a SPACED pair is subtraction; an UNSPACED pair is a range and stays silent", () => {
        expect(say("5 − 3")).toContain(minus);
        expect(say("५−३")).not.toContain(minus);
        expect(say("१८३८−१९१७")).not.toContain(minus);
        expect(say("41−49")).not.toContain(minus);
    });

    test("⚠ the ASCII hyphen is UNCHANGED — compounds and designations must stay silent", () => {
        expect(say("-५")).not.toContain(minus);
        expect(say("चंद्रयान -1")).not.toContain(minus);
        expect(say("आस-पास")).not.toContain(minus);
    });

    test("the range rule still owns the hyphen and the dashes", () => {
        // १६४४-१९१२ is ascending, so it reads as a range and not as a subtraction.
        expect(say("१६४४-१९१२")).toContain(say(DEF.rangeWord));
        expect(say("१६४४-१९१२")).not.toContain(minus);
    });

    test("the word comes from the manifest, and is the one ± already asserts", () => {
        expect(say("±५")).toContain(minus);
        expect(DEF.symbolWords.plusMinus).toContain(DEF.symbolWords.minus);
    });
});

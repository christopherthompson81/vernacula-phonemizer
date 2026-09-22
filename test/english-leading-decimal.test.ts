/**
 * A leading-point decimal gets its zero (#1437), split out of #1435.
 *
 * ⚠ THE TOKEN WAS NEVER A NUMBER AT ALL, so every downstream rule declined it in turn. These cases pin
 * the CASCADE rather than the reading: the unit rule's `NOT_VERSION` lookbehind refuses a digit preceded
 * by `.`, and the range rule is digit-gated on both sides, so one insertion fixes all of it and nothing
 * new is asserted about how a decimal reads.
 */
import { describe, expect, test } from "vitest";
import { normalizeEnglish } from "../src/languages/english/normalize.ts";
import { phonemize } from "../src/index.ts";

describe("a leading-point decimal is a number", () => {
    // ⚠ A WRONG MAGNITUDE IS WORSE THAN A DROP — `.002` read "two", off by a factor of 500, and
    // entirely fluent.
    test("the point and its zeros survive", () => {
        expect(normalizeEnglish(".002")).toBe("0.002");
        expect(normalizeEnglish(".5")).toBe("0.5");
        expect(phonemize(".002", "en")).toBe(phonemize("0.002", "en"));
        expect(phonemize(".002", "en")).not.toBe(phonemize("2", "en"));
    });

    // ⚠ THE UNIT WAS REACHING THE G2P AS BARE LETTERS — ⟨kg⟩ read as the word *king*, ⟨mm⟩ as *m*.
    test.each([
        [".002 mm", "0.002 millimeters"],
        [".5 kg", "0.5 kilograms"],
        [".25 L", "0.25 liters"],
        [".5%", "0.5 percent"],
    ])("%s keeps its unit", (text, expected) => expect(normalizeEnglish(text)).toBe(expected));

    test("kg is no longer read as a word", () => {
        expect(phonemize(".5 kg", "en")).not.toContain("kʰˈɪŋ");
        expect(phonemize(".5 kg", "en")).toBe(phonemize("0.5 kg", "en"));
    });

    // ⚠ AND THE RANGE IS DIGIT-GATED ON BOTH SIDES, so the dash survived as a phrase break — the
    // *<pause>* in the original report.
    test("a range of leading-point decimals reads as a range", () => {
        expect(normalizeEnglish(".5–.75 mm")).toBe("0.5 to 0.75 millimeters");
        expect(normalizeEnglish(".002–.005")).toBe("0.002 to 0.005");
    });

    /**
     * ⚠ THE LOOKBEHIND CARRIES THE WHOLE GUARD. A point preceded by a LETTER is an abbreviation, by a
     * DIGIT a version or an address, by another POINT an ellipsis. A sentence-final period is followed
     * by a space, so the digit lookahead excludes it without knowing anything about sentences.
     */
    test.each(["Fig.2", "v1.002", "192.168.1.1", "10.0.0.1", "..002", "3.14", "1,234.5", "Section 3.2"])(
        "%s is untouched", (w) => expect(normalizeEnglish(w)).toBe(w));

    test("a sentence boundary is not a decimal point", () => {
        expect(normalizeEnglish("End. 002 next")).toBe("End. 002 next");
        expect(normalizeEnglish("He left. 5 came")).toBe("He left. 5 came");
    });

    // ⚠ CURRENCY FALLS OUT FOR FREE, because the currency rule was declining the same token.
    test("a bare-point money amount reads", () => {
        expect(normalizeEnglish("$.50")).toBe("50 cents");
        expect(normalizeEnglish("£.75")).toBe("75 pence");
    });

    /**
     * ⚠ A LEADING POINT IS NOT ALWAYS A DECIMAL, and this was a REGRESSION the first draft introduced.
     * A firearm CALIBER and a batting AVERAGE are integer labels written with a point, and all of these
     * were ALREADY CORRECT before the rule existed — `.50 caliber` read "fifty caliber" and became
     * "zero point five zero caliber". That is the same wrong-magnitude failure this rule exists to fix,
     * pointed the other way. No shape separates `.300` the average from `.300` the decimal, so the gate
     * is lexical: a cue word after the digits, or `batting`/`hitting` before the point.
     */
    test.each([".50 caliber", ".45 ACP", ".38 Special", ".22 LR", ".223 Remington", ".308 Winchester",
        "batting .300", "hitting .350"])("%s is not a decimal", (w) => {
        expect(normalizeEnglish(w)).toBe(w);
        expect(phonemize(w, "en")).not.toContain("pʰɔᶦnt");
    });

    // ⚠ KNOWN AND ACCEPTED COST, pinned so it is a decision: a BARE caliber with no cue has nothing
    // to key on and becomes a decimal. That is the residue of a genuinely ambiguous spelling.
    test("a bare caliber has no cue and is read as a decimal", () => {
        expect(normalizeEnglish("he carried a .45")).toBe("he carried a 0.45");
    });

    // ⚠ THE ASCII HYPHEN IS STILL NOT A RANGE, and that is the documented decision, not a gap: it is a
    // date, a phone number and a score far more often than a span, so `5-10` does not say "to" either.
    test("the ASCII hyphen is left as it was", () => {
        expect(normalizeEnglish(".002-.005")).toBe("0.002-0.005");
        expect(normalizeEnglish("5-10")).toBe("5-10");
    });
});

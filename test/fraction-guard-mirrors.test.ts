import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";

// The fraction rule's two guards are MIRRORS in hi gu mr ne ta lb, as in ur (#1477) and cmn (#1492). The right
// side used to refuse only a digit or `/`, so `1/2.5` read a half and a stranded `.5`. In ta and lb the decimal
// rule also ran FIRST, so the fraction read off the decimal's tail (`1.5/2` → "one point, five halves"); there
// the fraction now runs before the decimals. Expectations are RELATIONAL — a declined fraction reads as its two
// numbers spaced, a read one as itself spaced — never typed IPA.

/** The language's own digits, for the native-digit twin of a probe. */
const NATIVE: Record<string, number> = { hi: 0x966, mr: 0x966, ne: 0x966, gu: 0xae6, ta: 0xbe6 };
const native = (lang: string, s: string): string =>
    s.replace(/\d/g, (d) => String.fromCodePoint(NATIVE[lang]! + Number(d)));

describe.each(["hi", "gu", "mr", "ne", "ta"])("%s: the fraction guards are mirrors", (lang) => {
    const say = (s: string): string => phonemize(s, lang);

    test.each([
        ["1/2.5", "1 2.5"], // a decimal on the right
        ["1.5/2", "1.5 2"], // a decimal on the left
        ["1/2.5/3", "1 2.5 3"], // the declined decimal does not leave `5/3` to be read
        ["1/1,000,000", "1 1,000,000"], // a Western thousands group
        ["1/1,00,000", "1 1,00,000"], // an Indian lakh group
        ["5,000/10,000", "5,000 10,000"],
    ])("%s is declined, reading as %s", (input, parts) => {
        expect(say(input)).toBe(say(parts));
    });

    test.each([
        ["1/2,3/4", "1/2, 3/4"], // a list comma: both fractions read
        ["3,4/5", "3, 4/5"],
        ["1/2.", "1/2 ."], // a sentence-final full stop is not a decimal
    ])("%s reads like %s", (input, spaced) => {
        expect(say(input)).toBe(say(spaced));
    });

    test("native digits behave as their ASCII twins", () => {
        expect(say(native(lang, "1/2.5"))).toBe(say("1 2.5"));
        expect(say(native(lang, "1/2,3/4"))).toBe(say("1/2, 3/4"));
    });

    test("a plain fraction still reads", () => {
        expect(say("1/2")).not.toBe(say("1 2"));
    });
});

describe("lb: the fraction guards are mirrors, and the fraction runs before the decimals", () => {
    const say = (s: string): string => phonemize(s, "lb");

    test.each([
        ["1/2,5", "1 2,5"], // the language's own decimal comma, right
        ["1,5/2", "1,5 2"], // and left — used to read "eent Komma fënnef hallef"
        ["1/2.5", "1 2.5"], // the anglicism dot decimal, right
        ["1.5/2", "1.5 2"], // and left
        ["3/4,5", "3 4,5"],
        ["1/2:3", "1 2:3"], // a clock colon, mirrored from the left side
    ])("%s is declined, reading as %s", (input, parts) => {
        expect(say(input)).toBe(say(parts));
    });

    test("a plain and a sentence-final fraction still read", () => {
        expect(say("1/2")).not.toBe(say("1 2"));
        expect(say("1/5 .")).toBe(say("1/5."));
    });
});

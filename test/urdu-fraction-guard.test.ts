import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";

// #1477: the Urdu FRACTION rule's two guards are MIRRORS, as Mandarin's are (mandarin/normalize.ts). The right
// side used to refuse only a digit or `/`, while the left refused any `.` or `,`: `1/2.5` read آدھا then ".5",
// `1/1,000,000` read a fraction then "000,000", and a list comma before a fraction declined it.
// Expectations are RELATIONAL — a declined fraction reads as its two numbers, a read one as itself — never typed IPA.
const ur = (s: string): string => phonemize(s, "ur");

describe("urdu fraction guards are mirrors (#1477)", () => {
    test.each([
        ["1/2.5", "1 2.5"], // a decimal on the right
        ["1.5/2", "1.5 2"], // a decimal on the left
        ["1/1,000,000", "1 1,000,000"], // a thousands group on the right
        ["5,000/10,000", "5,000 10,000"], // on both sides
        ["1/2.5/3", "1 2.5 3"], // the declined decimal does not leave `5/3` to be read
        ["١/٢٫٥", "1 2.5"], // Arabic-Indic digits, ARABIC DECIMAL SEPARATOR
        ["١/١٬٠٠٠", "1 1,000"], // ARABIC THOUSANDS SEPARATOR
        ["۵،۰۰۰/۱۰،۰۰۰", "5,000 10,000"], // Extended Arabic-Indic, ، as a grouping mark
    ])("%s is declined, reading as %s", (input, parts) => {
        expect(ur(input)).toBe(ur(parts));
    });

    test.each([
        ["1/2,3/4", "1/2, 3/4"], // a list comma: both fractions read
        ["3/4,5", "3/4, 5"],
        ["3,4/5", "3, 4/5"],
        ["پانی,1/2", "پانی, 1/2"],
        ["۱/۲،۳/۴", "1/2، 3/4"],
    ])("%s reads like %s (a list comma is not a number)", (input, spaced) => {
        expect(ur(input)).toBe(ur(spaced));
    });

    test("a sentence-final 1/2. still reads", () => {
        expect(ur("یہ 1/2.")).toBe(ur("یہ 1/2 ."));
        expect(ur("1/2")).not.toBe(ur("1 2"));
    });
});

/**
 * #1503: an SI pressure unit after a number reads as its word, case-exactly. Expectations are relational:
 * each input reads like the spelled-out unit, and the case-folded near-misses are left as written. No IPA is
 * typed. Inputs are synthetic.
 */
import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { normalizeEnglish } from "../src/languages/english/normalize.ts";

describe("en #1503: pascals", () => {
    const read: [string, string][] = [
        ["at 2 GPa", "at 2 gigapascals"],
        ["at 1 GPa", "at 1 gigapascal"],
        ["at 101.3 kPa", "at 101.3 kilopascals"],
        ["1013 hPa", "1013 hectopascals"],
        ["200 MPa", "200 megapascals"],
        ["5 mPa", "5 millipascals"],
        ["5 Pa", "5 pascals"],
        ["1 Pa", "1 pascal"],
        ["2 million Pa", "2 million pascals"],
    ];
    for (const lang of ["en", "en-GB"])
        for (const [unit, word] of read)
            test(`${lang}: ${unit} reads as ${word}`, () => expect(phonemize(unit, lang)).toBe(phonemize(word, lang)));

    // Folding would make these pascals: a grade point average, the credential code, and lowercase shorthand.
    for (const kept of ["a 3.8 GPA", "2 PA students", "5 pa", "5 PA", "5 gpa", "GPa alone"])
        test(`left as written: ${kept}`, () => expect(normalizeEnglish(kept)).toBe(kept));
});

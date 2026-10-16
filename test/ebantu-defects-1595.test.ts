/**
 * #1595: sw/rw/rn/nya/ln defects found by the Rust port of the ebantu group (#1594). All inputs are synthetic.
 * Relational throughout, so no IPA is typed: each input must read exactly as its written-out form.
 * Mirrored in C# (`EbantuDefects1595Tests.cs`) and in each language's Rust module.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";

const same = (lang: string, input: string, written: string): void => {
    expect(phonemize(input, lang), `${lang} ${input}`).toBe(phonemize(written, lang));
};

describe("#1595", () => {
    test("sw: a temperature range keeps its span word and takes the measure noun once", () => {
        same("sw", "10-15°C", "nyuzi joto 10 hadi 15 Selsiasi");
        same("sw", "2.5-3.5°F", "nyuzi joto 2.5 hadi 3.5 Fahrenheit");
        same("sw", "10-15°", "nyuzi joto 10 hadi 15");
        // Not ascending: a score-shaped pair is not a span, and falls through to the degree arm as before.
        same("sw", "15-10°C", "15-nyuzi joto 10 Selsiasi");
    });

    test("rw, rn, nya: a decimal with three or more fraction digits reads as one number", () => {
        for (const lang of ["rw", "rn", "nya"]) {
            same(lang, "0.125", "0 1 2 5");
            same(lang, "3.14159", "3 1 4 1 5 9");
        }
    });

    test("ln: an exponent is not a French ordinal, and a tight ordinal still reads", () => {
        same("ln", "1e5", "1 e 5");
        same("ln", "2e6", "2 e 6");
        same("ln", "2e", "ya 2");
    });
});

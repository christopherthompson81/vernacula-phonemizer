/**
 * Hindi's ordinal rule above 2^53, and the family's ordinal fallback (#1463, found by the Rust port).
 *
 * ⚠ THE ORDINAL ARM COMPOSED WHAT THE NUMBER PATH REFUSES TO. `number()` declines to compose an unsafe
 * integer and spells its digits, but step 2 of normalize.ts handed `Number(digits)` straight to the
 * compositor: `9007199254740993वाँ` read as …992 (the float had already lost the last digit), and a run of
 * 309+ digits is `Infinity`, whose composition recursed until `phonemize` threw `RangeError: Maximum call
 * stack size exceeded`. The ordinal now declines there too, so the digits are spelled by the number path.
 *
 * Expectations are relational (derived from the engine itself), never hand-typed IPA.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { makeHindiNormalizer } from "../src/languages/hindi/normalize.ts";
import { MANIFEST } from "../src/languages/hindi/manifest.ts";

/** Every language whose engine runs `makeHindiNormalizer` (bgc is served by `hi`, mai wraps it). */
const FAMILY = ["hi", "bgc", "awa", "bho", "hne", "mag", "mai", "rkt"] as const;

describe("the ordinal rule declines above 2^53, as the number path does", () => {
    const norm = makeHindiNormalizer(MANIFEST.numbers, MANIFEST);

    test("an unsafe ordinal is left as written for the number path", () => {
        expect(norm("9007199254740993वाँ")).toBe("9007199254740993वाँ");
        expect(norm("9007199254740992 वीं")).toBe("9007199254740992 वीं");
        // The largest safe integer still composes as an ordinal.
        expect(norm("9007199254740991वाँ")).not.toMatch(/\d/u);
    });

    test.each(FAMILY)("%s: 2^53+1 reads its own digits, not 2^53's", (lang) => {
        const above = phonemize("9007199254740993वाँ", lang);
        expect(above).not.toBe(phonemize("9007199254740992वाँ", lang));
        expect(above).toBe(`${phonemize("9007199254740993", lang)} ${phonemize("वाँ", lang)}`);
        expect(above).not.toMatch(/\d/u);
    });

    test.each(FAMILY)("%s: a 400-digit ordinal does not throw", (lang) => {
        const digits = "1".repeat(400);
        const out = phonemize(`${digits}वाँ`, lang);
        expect(out).toBe(`${phonemize(digits, lang)} ${phonemize("वाँ", lang)}`);
        expect(out).not.toMatch(/\d/u);
    });
});

describe("a family member that declares no ordinal data gets Hindi's", () => {
    // The contract the HindiDef docs now state: `own?.ordinalSuffixes ?? DEFAULT_SUFFIXES`, deliberately.
    test("no `ordinalSuffixes` and no `irregularOrdinals` fall back to Hindi's tables", () => {
        const bare = makeHindiNormalizer(MANIFEST.numbers, {});
        const hindi = makeHindiNormalizer(MANIFEST.numbers, MANIFEST);
        for (const s of ["16वीं", "1ला", "4था", "25 वें"]) {
            expect(bare(s)).toBe(hindi(s));
            expect(bare(s)).not.toMatch(/\d/u);
        }
    });

    test("only a declared EMPTY table turns the rule off", () => {
        const off = makeHindiNormalizer(MANIFEST.numbers,
            { ordinalSuffixes: { regular: {}, suppletiveConsonants: {}, vowelForms: {} } });
        expect(off("16वीं")).toBe("16वीं");
    });
});

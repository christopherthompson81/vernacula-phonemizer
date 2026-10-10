/**
 * Marathi's ordinal rule above 2^53 (#1463). The same gap as Hindi's twin (hindi-ordinal-safe-integer.test.ts):
 * `9007199254740993वा` composed …992, and a 309+-digit ordinal (`Infinity`) overflowed the stack out of
 * `phonemize`. The rule now declines there, and the number path spells the digits.
 *
 * Expectations are relational (derived from the engine itself), never hand-typed IPA.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";

const mr = (s: string): string => phonemize(s, "mr");

describe("mr: the ordinal rule declines above 2^53, as the number path does", () => {
    test.each(["वा", "व्या"])("2^53+1 with -%s reads its own digits, not 2^53's", (suffix) => {
        const above = mr(`9007199254740993${suffix}`);
        expect(above).not.toBe(mr(`9007199254740992${suffix}`));
        expect(above).toBe(`${mr("9007199254740993")} ${mr(suffix)}`);
        expect(above).not.toMatch(/\d/u);
    });

    test("a 400-digit ordinal does not throw", () => {
        const digits = "1".repeat(400);
        const out = mr(`${digits}वा`);
        expect(out).toBe(`${mr(digits)} ${mr("वा")}`);
        expect(out).not.toMatch(/\d/u);
    });

    test("the largest safe integer still composes as an ordinal", () => {
        expect(mr("9007199254740991वा")).not.toBe(`${mr("9007199254740991")} ${mr("वा")}`);
    });
});

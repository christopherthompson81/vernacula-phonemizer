import { describe, expect, it } from "vitest";
import { parseJsonc, stripJsonc } from "../src/core/jsonc.ts";

describe("JSONC parser", () => {
    it("parses plain JSON", () => {
        expect(parseJsonc('{"a":1,"b":[2,3]}')).toEqual({ a: 1, b: [2, 3] });
    });

    it("strips line and block comments", () => {
        const src = `{
      // a leading comment
      "a": 1, // a trailing comment
      /* block
         comment */
      "b": 2
    }`;
        expect(parseJsonc(src)).toEqual({ a: 1, b: 2 });
    });

    it("tolerates trailing commas in objects and arrays", () => {
        expect(parseJsonc('{ "a": 1, "b": 2, }')).toEqual({ a: 1, b: 2 });
        expect(parseJsonc("[ 1, 2, 3, ]")).toEqual([1, 2, 3]);
        expect(parseJsonc('{ "a": [1, 2,], }')).toEqual({ a: [1, 2] });
    });

    it("is STRING-AWARE — comment/comma sequences inside strings are preserved", () => {
        expect(parseJsonc('{ "url": "https://example.com/a//b" }')).toEqual({
            url: "https://example.com/a//b",
        });
        expect(parseJsonc('{ "note": "a /* not a comment */ b" }')).toEqual({
            note: "a /* not a comment */ b",
        });
        expect(parseJsonc('{ "x": "trailing,}", "y": 1 }')).toEqual({
            x: "trailing,}",
            y: 1,
        });
        expect(
            parseJsonc('{ "q": "an escaped \\" quote // still string" }'),
        ).toEqual({ q: 'an escaped " quote // still string' });
    });

    it("⚠ objects are NULL-PROTOTYPE — a manifest is indexed by text and ⟨constructor⟩ is a word", () => {
        const parsed = parseJsonc<Record<string, unknown>>(
            '{ "a": 1, "n": { "b": 2 }, "arr": [{ "c": 3 }] }',
        );
        expect(Object.getPrototypeOf(parsed)).toBe(null);
        expect(Object.getPrototypeOf(parsed["n"])).toBe(null);
        expect(Object.getPrototypeOf((parsed["arr"] as unknown[])[0])).toBe(null);
        expect(Array.isArray(parsed["arr"])).toBe(true); // arrays keep THEIR prototype — .map/.filter still work
        // The defect this closes: seven engines threw because this lookup returned Object.prototype.constructor.
        expect(parsed["constructor"]).toBeUndefined();
        expect(parsed["toString"]).toBeUndefined();
    });

    it("stripJsonc leaves a comment-free, trailing-comma-free document", () => {
        expect(stripJsonc('{ "a": 1, /* c */ }').replace(/\s+/g, "")).toBe(
            '{"a":1}',
        );
    });
});

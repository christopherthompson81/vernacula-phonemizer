/**
 * Four defects the Rust port found by reading (#1463), fixed TS-first.
 *
 * ⚠ THREE ARE ONE CLASS: a plain object used as a lookup table also answers for `Object.prototype`, so an
 * inherited key counted as a hit. The fourth, `isoDate`, is a docstring/code gap: it promised to reject
 * dates that are not real and only range-checked them.
 */
import { describe, expect, test } from "vitest";
import { stripMarkup } from "../src/core/markup.ts";
import { foldedIndex, resolveUnitSymbol } from "../src/core/normalizeSymbols.ts";
import { own } from "../src/core/own.ts";
import { normalizeEnglish } from "../src/languages/english/normalize.ts";
import { phonemize } from "../src/index.ts";

describe("lookup tables answer only for their own keys", () => {
    test("own() does not find inherited members", () => {
        const t = { a: 1 };
        expect(own(t, "a")).toBe(1);
        expect(own(t, "constructor")).toBeUndefined();
        expect(own(t, "toString")).toBeUndefined();
        expect(own(undefined, "a")).toBeUndefined();
    });

    test("foldedIndex drops a slot whose declared keys disagree, and is null-prototype", () => {
        const f = foldedIndex({ "µm": ["micro meter"], "µM": ["micromolar"], km: ["kilometer"], KM: ["kilometer"] });
        expect(Object.keys(f)).toEqual(["km"]);
        expect(Object.getPrototypeOf(f)).toBeNull();
    });

    test("an entity named like a prototype member stays literal", () => {
        expect(stripMarkup("a &constructor; b")).toBe("a &constructor; b");
        expect(stripMarkup("a &Constructor; b")).toBe("a &Constructor; b");
        expect(stripMarkup("a &amp; b")).toBe("a & b");
        expect(phonemize("Use &constructor; here.", "en")).not.toContain("ˈɑːbd͡ʒɛkt");
    });

    test("resolveUnitSymbol does not resolve an inherited member", () => {
        const declared = { km: ["kilometer", "kilometers"] };
        const folded = { km: ["kilometer", "kilometers"] };
        expect(resolveUnitSymbol(declared, folded, "toString")).toBeUndefined();
        expect(resolveUnitSymbol(declared, folded, "constructor")).toBeUndefined();
        expect(resolveUnitSymbol(declared, folded, "KM")).toEqual(["kilometer", "kilometers"]);
    });

    test("the slash rule's rate test ignores inherited members", () => {
        // Neither side is a rate any more, and a prose slash between lowercase words stays as written.
        expect(normalizeEnglish("litres/constructor")).toBe("litres/constructor");
        expect(normalizeEnglish("toString/apples")).toBe("toString/apples");
        expect(normalizeEnglish("litres/day")).toBe("litres per day");
    });
});

describe("a case-stripped micro symbol is not given a unit it cannot choose", () => {
    // `ΜM` (U+039C) is what both µm and µM become in an upper-cased document; it read "micro meters" for a
    // micromolar concentration. Every DECLARED spelling still resolves exactly.
    test("an ambiguous fold declines", () => {
        // The chosen reading: no unit, so the Greek letter and the capital are each said as letters.
        expect(normalizeEnglish("25 ΜM")).toBe("25 mu M");
        expect(normalizeEnglish("5 ΜS")).toBe("5 mu S");
    });
    test("declared forms and unambiguous folds are unchanged", () => {
        expect(normalizeEnglish("25 µM")).toBe("25 micromolar");
        expect(normalizeEnglish("4 µm")).toBe("4 micro meters");
        expect(normalizeEnglish("3 ΜG")).toBe("3 micrograms");
        expect(normalizeEnglish("10 MΩ and 10 mΩ")).toBe("10 mega ohms and 10 milli ohms");
    });
});

describe("isoDate rejects dates that do not exist", () => {
    test("day past the end of its month", () => {
        // Not a date, so the date rules leave it exactly as written.
        expect(normalizeEnglish("2024-02-31")).toBe("2024-02-31");
        expect(normalizeEnglish("2/30/2024")).toBe("2/30/2024");
        expect(normalizeEnglish("2024-04-31")).toBe("2024-04-31");
    });
    test("leap years, Gregorian", () => {
        expect(normalizeEnglish("2024-02-29")).toContain("february 29th");
        expect(normalizeEnglish("2000-02-29")).toContain("february 29th");
        expect(normalizeEnglish("2023-02-29")).toBe("2023-02-29");
        expect(normalizeEnglish("1900-02-29")).toBe("1900-02-29");
        expect(normalizeEnglish("2024-12-31")).toContain("december 31st");
    });
});

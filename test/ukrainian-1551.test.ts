/**
 * #1551 (uk): a leading-zero minute is read with *нуль*, and a capital initial-shaped letter before a name is an
 * initial, not the year abbreviation. The clock expectation is the source's own example — the Kyiv Dictionary's
 * language consultation gives «о восьмій нуль п'ять» (kyivdictionary.com, Випуск 5); the initial is relational.
 * Inputs are synthetic.
 */
import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { normalizeUkrainian } from "../src/languages/ukrainian/normalize.ts";

describe("uk #1551", () => {
    test("the source's example: о 8:05 is о восьмій нуль п'ять", () => {
        expect(normalizeUkrainian("о 8:05")).toBe("о восьмій нуль п'ять");
    });
    test("a non-zero-led minute and the full hour are unchanged", () => {
        expect(normalizeUkrainian("о 10:10")).not.toContain("нуль");
        expect(normalizeUkrainian("о 9:00")).not.toContain("нуль");
    });
    test("Р. before a surname is the initial ер, as Т. is те", () => {
        expect(phonemize("Р. Шухевич був", "uk")).toBe(phonemize("ер Шухевич був", "uk"));
        expect(phonemize("Р. Р. Шухевич", "uk")).toBe(phonemize("ер ер Шухевич", "uk"));
    });
    test("the lowercase year abbreviation still expands, and keeps its sentence end", () => {
        expect(normalizeUkrainian("у 1990 р. Потім")).toBe(normalizeUkrainian("у 1990 року. Потім"));
        expect(normalizeUkrainian("у 1990 р. потім")).toBe(normalizeUkrainian("у 1990 року потім"));
        expect(normalizeUkrainian("Див. Петренко")).toBe(normalizeUkrainian("дивись Петренко"));
    });
});

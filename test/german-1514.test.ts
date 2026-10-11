/**
 * #1514: five German defects the Rust port found. Expectations are relational — each input must read the
 * same as a spelling the engine already reads correctly — never typed IPA. Inputs are synthetic.
 */
import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { toSegments } from "../src/languages/german/g2p.ts";
import { normalizeGerman } from "../src/languages/german/normalize.ts";

const de = (s: string): string => phonemize(s, "de");

describe("#1514 German", () => {
    test("a grouped amount keeps its decimal comma", () => {
        expect(de("3.000,50 Euro")).toBe(de("3000,50 Euro"));
        expect(de("1.000,5")).toBe(de("1000,5"));
        expect(de("1.000.000,25 Euro")).toBe(de("1000000,25 Euro"));
        expect(de("1.000, dann")).toBe(de("1000, dann")); // a comma with no digit after stays a pause
    });

    test("z. B. and u. Ä. match lowercased input", () => {
        expect(de("z. b. das")).toBe(de("z. B. das"));
        expect(de("z.b. das")).toBe(de("z.B. das"));
        expect(de("u. ä. mehr")).toBe(de("u. Ä. mehr"));
        expect(normalizeGerman("z. b. das")).toBe(normalizeGerman("z. B. das"));
    });

    test("a denominator of 1 is not a fraction word", () => {
        expect(normalizeGerman("1/1")).toBe("1/1");
        expect(normalizeGerman("2/1")).toBe("2/1");
        expect(de("1/1")).toBe(de("1 1"));
        expect(normalizeGerman("1/2")).not.toBe("1/2"); // a real fraction still reads
    });

    test("1 Mio. and 1 Mrd. are singular with the article", () => {
        expect(de("1 Mio. Euro")).toBe(de("eine Million Euro"));
        expect(de("1 mio. Euro")).toBe(de("eine Million Euro"));
        expect(de("1 Mrd. Menschen")).toBe(de("eine Milliarde Menschen"));
        expect(de("das kostet 1 Mio.")).toBe(de("das kostet eine Million."));
        // Anything but a bare 1 keeps the plural path.
        expect(de("2 Mio. Euro")).toBe(de("2 Millionen Euro"));
        expect(de("11 Mio. Euro")).toBe(de("11 Millionen Euro"));
        expect(de("1,1 Mio. Euro")).toBe(de("1,1 Millionen Euro"));
    });

    test("a non-initial ch with no vowel before it is the ich-laut", () => {
        const phs = toSegments("lchen").map((s) => s.ph);
        expect(phs).not.toContain("x");
        expect(phs).toContain("ç");
        // a back vowel still gives the ach-laut
        expect(toSegments("lachen").map((s) => s.ph)).toContain("x");
    });
});

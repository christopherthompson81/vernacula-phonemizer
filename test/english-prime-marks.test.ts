/**
 * The prime and double-prime as feet and inches, and the DMS coordinate that makes them ambiguous
 * (#1435).
 *
 * ⚠ THE MARKS WERE DROPPED OUTRIGHT — `0.015″` read "zero point zero one five", `5′ 6″ tall` read
 * "five six tall", a height with no units at all. A silent drop of a unit is the class normalize.ts
 * ranks worst: nothing in the stream looks wrong.
 */
import { describe, expect, test } from "vitest";
import { normalizeEnglish } from "../src/languages/english/normalize.ts";
import { phonemize } from "../src/index.ts";

describe("a prime is a foot and a double prime an inch", () => {
    test.each([
        ["0.015″", "0.015 inches"],
        ["0.015″ wall", "0.015 inches wall"],
        ["12″ pipe", "12 inches pipe"],
        ["5′", "5 feet"],
        ["5′ 6″ tall", "5 feet 6 inches tall"],
        ["1″", "1 inch"],            // count agreement comes free from the unit table
        ["1′", "1 foot"],
    ])("%s", (text, expected) => expect(normalizeEnglish(text)).toBe(expected));

    // ⚠ THE REPORTED CASE END TO END, which needed all three of #1437, the range rule and this one.
    test("the reported tolerance range reads whole", () => {
        expect(normalizeEnglish(".002–.005″")).toBe("0.002 to 0.005 inches");
        expect(phonemize(".002–.005″", "en")).toBe(phonemize("0.002 to 0.005 inches", "en"));
    });

    /**
     * ⚠ A DEGREE SIGN CHANGES WHAT THE MARKS MEAN: arcminutes and arcseconds, not feet and inches. The
     * coordinate is consumed FIRST so that every prime the unit rule then sees is unambiguously a foot
     * or an inch — which is what lets ⟨′⟩ and ⟨″⟩ be plain unit keys at all.
     */
    test.each([
        ["40°26′46″N", "40 degrees 26 minutes 46 seconds north"],
        ["40° 26′ 46″ N", "40 degrees 26 minutes 46 seconds north"],
        ["51°30′N", "51 degrees 30 minutes north"],
        ["40°26.5′N", "40 degrees 26.5 minutes north"],
        ["1°1′", "1 degree 1 minute"],
    ])("%s is a coordinate", (text, expected) => expect(normalizeEnglish(text)).toBe(expected));

    // ⚠ THE CASE THAT KILLED THE OTHER DESIGN. A backward scan for a preceding ⟨°⟩ has to admit a
    // decimal and interior spaces, and once it admits both it also matches a SENTENCE END — this `5″`
    // would have been read as an arcsecond. Matching the whole coordinate has no such edge.
    test("a degree in the previous sentence is not a coordinate", () => {
        expect(normalizeEnglish("the angle is 90°. 5″ of travel"))
            .toBe("the angle is 90 degrees. 5 inches of travel");
    });

    // ⚠ THE HEMISPHERE LETTER ENDS ON `(?![\p{L}\p{M}])`, NOT `\b`. JS defines `\b` on ASCII `\w`, so
    // it finds a boundary between `N` and a non-ASCII letter — `40°26′Nörd` read "…minutes northörd".
    // That is the defect class of #949 (`25°Cölner` → "Grad Celsius" + "ölner"), which is why
    // `test/letter-boundary.test.ts` pins this spelling fleet-wide.
    test("the hemisphere letter is not claimed before a non-ASCII letter", () => {
        expect(normalizeEnglish("40°26′Nörd")).not.toContain("north");
        expect(normalizeEnglish("40°26′N")).toContain("north");
    });

    // ⚠ MINUTES ARE REQUIRED, so the coordinate rule claims nothing the unit rule already handles.
    test.each([["5°C", "5 degrees Celsius"], ["5°", "5 degrees"], ["40°26", "40 degrees 26"]])(
        "%s is left to the unit rule", (text, expected) => expect(normalizeEnglish(text)).toBe(expected));

    // ⚠ A PRIME WITH NO NUMBER IN FRONT IS NOT A UNIT — the mathematical prime is the common case.
    test.each(["f′(x)", "x′", "′″", "″"])("%s is untouched", (w) =>
        expect(normalizeEnglish(w)).toBe(w));

    /**
     * ⚠ THE ASCII QUOTES ARE DELIBERATELY NOT CLAIMED. `"` and `'` are quotation marks and apostrophes
     * far more often than they are units, and `5'` in prose is usually a quote — the same reasoning
     * that keeps ⟨in⟩ out of the unit table while ⟨µin⟩ is a whole key (#1427). U+2032 and U+2033 are
     * only ever prime marks, which is what makes them safe.
     */
    test.each(['0.015"', "5'", `5' 6"`])("%s is left alone", (w) =>
        expect(normalizeEnglish(w)).toBe(w));
});

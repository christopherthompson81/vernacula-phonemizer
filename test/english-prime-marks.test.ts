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

    /**
     * ⚠ THE TIGHT SPELLING IS THE COMMON ONE, AND IT WAS CORRUPTED. `UNIT_RE`'s exponent group ate the
     * inches digit the moment ⟨′⟩ became a unit key: `6′2″` read "6 SQUARE FEET" with the inches
     * stranded, `6′3″` "6 cubic feet". That is the defect #1434 fixed for ⟨°⟩, reintroduced one
     * symbol over — and the SPACED form was always fine, which is exactly why the first tests missed it.
     * Guarding the exponent alone was not enough either: it left the ⟨″⟩ behind, dropped ("6 feet 2").
     * The pair has to be consumed whole.
     */
    test.each([
        ["6\u20322\u2033", "6 feet 2 inches"],
        ["6\u20323\u2033", "6 feet 3 inches"],
        ["5\u20322\u2033 tall", "5 feet 2 inches tall"],
        ["4\u203233\u2033", "4 feet 33 inches"],
        ["1\u20321\u2033", "1 foot 1 inch"],
        ["12\u20333", "12 inches 3"],
    ])("%s reads whole", (text, expected) => expect(normalizeEnglish(text)).toBe(expected));

    // ⚠ NBSP IS A SEPARATOR TOO. Typeset and pasted coordinates routinely use it, and with ⟨′⟩⟨″⟩
    // now unit keys the fallthrough is a CONFIDENT WRONG READING rather than a drop: arcminutes as feet.
    test("a coordinate separated by NBSP is still a coordinate", () => {
        expect(normalizeEnglish("40\u00b0\u00a026\u2032\u00a046\u2033\u00a0N"))
            .toBe("40 degrees 26 minutes 46 seconds north");
    });

    // ⚠ AN INTERCARDINAL BEARING IS ORDINARY on plans and surveys, and the single-letter group cannot
    // claim it — the letter-boundary lookahead correctly refuses `N` before `W`, which left the bearing
    // to FUSE into the last word ("… secondsNW").
    test("an intercardinal bearing is read, and nothing fuses into the last word", () => {
        expect(normalizeEnglish("40\u00b026\u203246\u2033NW")).toBe("40 degrees 26 minutes 46 seconds northwest");
        expect(normalizeEnglish("40\u00b026\u203246\u2033n")).toBe("40 degrees 26 minutes 46 seconds n");
    });

    // ⚠ COUNT AGREEMENT USES THE SAME NUMERIC TEST THE UNIT RULE USES, not a string compare — or the
    // two disagree on the same surface inside one sentence.
    test("agreement matches the unit rule", () => {
        expect(normalizeEnglish("1.0\u00b0")).toBe("1.0 degree");
        expect(normalizeEnglish("1.0\u00b01.0\u2032")).toBe("1.0 degree 1.0 minute");
        expect(normalizeEnglish("01\u00b001\u2032")).toBe("01 degree 01 minute");
    });

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

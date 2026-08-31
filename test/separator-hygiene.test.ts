import { describe, expect, test } from "vitest";
import { separatorHygiene } from "../src/core/separatorHygiene.ts";
import { phonemize } from "../src/index.ts";

/**
 * The corpus-independent subset, pinned — for the eight implemented languages that have no text at all.
 *
 * ⚠ HALF OF THIS SUITE PINS REFUSALS, and that half is the more important one. The pass is defensible only
 * because it declines every shape whose reading depends on a convention nobody has measured; a test that
 * lets `1.234` start being joined is the one that would turn this from a safe subset into a guess with a
 * 1000× error attached.
 */
describe("separator hygiene — what it claims", () => {
    test("two or more three-digit groups is grouping in every convention", () => {
        expect(separatorHygiene("1.234.567")).toBe("1234567");
        expect(separatorHygiene("1,234,567")).toBe("1234567");
        // ⚠ trap 58: a clause mark after the number must keep BOTH the number and the pause
        expect(separatorHygiene("1.234.567.")).toBe("1234567.");
    });

    // #1212 — THE SPACE GROUP, which was in neither the rules nor the refusals. `1.234.567` was joined and
    // `1 000 000` was not, so the same quantity was fixed in the two conventions these languages do not use
    // and missed in the one several of them do: smj and kl are Nordic orthography, where the SPACE is the
    // standard thousands separator. Untouched, `1 000 000` read *one zero zero* — a silent 1000× error, the
    // very class this pass exists to close.
    test("a space thousands separator is grouping — and ONE group is enough", () => {
        expect(separatorHygiene("1 000")).toBe("1000");
        expect(separatorHygiene("1 000 000")).toBe("1000000");   // to a fixed point
        expect(separatorHygiene("12 345 678")).toBe("12345678");
        expect(separatorHygiene("1 385 000 000")).toBe("1385000000");
        expect(separatorHygiene("1 000,5")).toBe("1000 5");      // the decimal rule still runs after
        // ⚠ ONE group suffices here and TWO are required for the dot/comma, and that asymmetry is the
        // point: `1.234` is ambiguous between grouping and a three-place decimal, and A SPACE IS NEVER A
        // DECIMAL SEPARATOR IN ANY CONVENTION. Lithuanian measured this exact shape over its own corpus —
        // 24 sites, all genuine, zero false positives.
        expect(separatorHygiene("1.234")).toBe("1.234");
    });

    test("⚠ the space group's two guards, each of which declines something real", () => {
        // EXACTLY three digits: a fourth disqualifies it, which is what keeps a bare date-like pair whole.
        expect(separatorHygiene("21 2001")).toBe("21 2001");
        expect(separatorHygiene("1 0000")).toBe("1 0000");
        expect(separatorHygiene("1 00")).toBe("1 00");
        // a STANDALONE zero is not a thousands head, so `0 000` is not welded into a figure nobody wrote
        expect(separatorHygiene("0 000")).toBe("0 000");
    });

    test("one or two digits after a mark is a decimal — the mark is spent, no word is emitted", () => {
        expect(separatorHygiene("3,5")).toBe("3 5");
        expect(separatorHygiene("19.95")).toBe("19 95");
    });

    test("three or more dot-joined runs is a date, a version or an address", () => {
        expect(separatorHygiene("26.02.1994")).toBe("26 02 1994");
        expect(separatorHygiene("198.51.100.0")).toBe("198 51 100 0");
        expect(separatorHygiene("v2.1.3")).toBe("v2 1 3");
    });

    test("an en or em dash between digits is a span, and becomes a PAUSE not a connective", () => {
        expect(separatorHygiene("1990–1995")).toBe("1990, 1995");
        expect(separatorHygiene("1990—1995")).toBe("1990, 1995");
    });
});

describe("separator hygiene — what it refuses, and must keep refusing", () => {
    test("⚠ a SINGLE grouped-looking run is ambiguous and is left alone", () => {
        // three digits after the mark = grouping in a grouping convention, a three-place decimal in a
        // decimating one. Joining it is a 1000× error; K'iche' (comma-groups) and Aromanian (dot-groups)
        // would need opposite answers and neither has a corpus to give one.
        expect(separatorHygiene("1.234")).toBe("1.234");
        expect(separatorHygiene("1,234")).toBe("1,234");
        expect(separatorHygiene("3.141")).toBe("3.141");
    });

    test("⚠ the HYPHEN is never touched — it is a word-joiner, a minus and a year marker elsewhere", () => {
        expect(separatorHygiene("1990-1995")).toBe("1990-1995");
        expect(separatorHygiene("COVID-19")).toBe("COVID-19");
    });

    test("⚠ the COLON is never touched — it is a Gospel citation and a Bible verse elsewhere", () => {
        expect(separatorHygiene("14:30")).toBe("14:30");
        expect(separatorHygiene("8:10-12")).toBe("8:10-12");
    });

    test("⚠ a sentence end followed by a numeral survives, and so does an ordinal period", () => {
        expect(separatorHygiene("Chapter 1. 5 things")).toBe("Chapter 1. 5 things");
        expect(separatorHygiene("1. maja")).toBe("1. maja");
    });

    test("no word is ever emitted — the output is a subset of the input's characters plus spaces", () => {
        for (const s of ["1.234.567", "3,5", "26.02.1994", "1990–1995", "50%", "$100", "25 °C"]) {
            const out = separatorHygiene(s);
            expect(out.replace(/[\s,]/gu, "")).toBe(s.replace(/[.,\s–—]/gu, ""));
        }
    });
});

describe("separator hygiene — wired into all eight corpus-less languages", () => {
    // The classes each engine could not read before: a grouped figure became two or three sentences.
    test.each(["quc", "naq", "rup", "nog", "kl", "mto", "smj", "grc"])(
        "%s reads a multi-group figure as one number, not three sentences", (lang) => {
            expect(phonemize("1.234.567", lang)).not.toContain(" . ");
            expect(phonemize("26.02.1994", lang)).not.toContain(" . ");
        });
});

/**
 * An enumerated list lead-in, and the one letter of 26 that was read as a word (#1423).
 *
 * ⚠ ⟨a⟩ IS THE ONLY LETTER THIS HAPPENS TO, which is what says it is a CLAIMING problem rather than a
 * naming one. The other 25 already give their letter name, because CMUdict carries them with
 * letter-NAME pronunciations and records `a` as the reduced article AH0 — so `letterNameExceptions`
 * already held the right value and nothing was asking it.
 *
 * ⚠ AND THE COST WAS NOT ONLY IN READING ALOUD. This one gap contaminated the MEASUREMENT of #1422
 * twice: a sweep that built its expected column from `phonemize("I O S")` reported 91 failures instead
 * of 50, and the test written for that fix walked into the same trap.
 */
import { describe, expect, test } from "vitest";
import { normalizeEnglish } from "../src/languages/english/normalize.ts";
import { phonemize } from "../src/index.ts";

describe("an enumerated list lead-in", () => {
    // ⚠ THE LETTER NAME AND A PAUSE, both of which the report asked for. The comma is this file's
    // existing spelling for a prosodic break.
    test.each([
        ["(a) the first item", "ay, the first item"],
        ["(b) second", "b, second"],
        ["a) foo", "ay, foo"],
        ["(A) foo", "ay, foo"],
        ["  (c) indented", "  c, indented"],
        ["(1) one", "1, one"],
    ])("%s", (text, expected) => expect(normalizeEnglish(text)).toBe(expected));

    test("the marker is no longer the article", () => {
        expect(phonemize("(a) the first item", "en")).not.toMatch(/^ə /u);
        expect(phonemize("(a) the first item", "en")).toContain("ˈeᶦ");
        expect(phonemize("(a) the first item", "en")).toContain(",");   // the pause
    });

    // ⚠ A REFERENCE IS NOT A LEAD-IN: the letter name, but no pause.
    test("a reference mid-sentence gets the name and no pause", () => {
        expect(normalizeEnglish("See (a) and (b).")).toBe("See (ay) and (b).");
        expect(phonemize("See (a) and (b).", "en")).toContain("ˈeᶦ");
        expect(normalizeEnglish("P(A) = 1")).toBe("P(ay) equals 1");
    });

    /**
     * ⚠ THE ARTICLE IS UNTOUCHED, which is the assertion that keeps this honest. A lone `a` between
     * spaces is the article and always was; the rules here require a bracket or a closing `)`, which an
     * article never has.
     */
    test.each(["a bird sang", "and a cat", "it was a test", "a"])("%s keeps its article", (w) =>
        expect(normalizeEnglish(w)).toBe(w));

    test("the article still reduces", () => {
        expect(phonemize("a bird sang", "en")).toMatch(/^ə /u);
    });

    // ⚠ FUNCTION NOTATION AND THE OPTIONAL PLURAL are the two shapes most like a marker, and neither is
    // at a line start with a following item.
    test.each(["f(x)", "form(s)", "g(y)"])("%s is untouched", (w) =>
        expect(normalizeEnglish(w)).toBe(w));

    /**
     * ⚠ THE SAME GAP IN AN ALPHANUMERIC CODE, and the same one letter. The shared initialism pass
     * claimed a caps run BEFORE digits but not one AFTER them, so a code's last letter fell to the OOV
     * g2p — where ⟨A⟩ alone reads as a word. `K1A 0B1` read "kay one UH zero bee one".
     * ⚠ IT TAKES NO UNIT WITH IT: the unit rules run BEFORE that pass, so `5L` is already "5 liters".
     * Measured fleet-wide, zero golden rows move in any of the 189 languages.
     */
    test.each([
        ["K1A", "k\u02b0\u02c8e\u1da6 w\u02c8\u028cn \u02c8e\u1da6"],
        ["1A 1", "w\u02c8\u028cn \u02c8e\u1da6 w\u02c8\u028cn"],
    ])("%s spells its trailing letter", (text, ipa) => expect(phonemize(text, "en")).toBe(ipa));

    test("a code reads end to end, and a unit still wins", () => {
        expect(phonemize("A1A 1A1", "en")).toBe(phonemize("ay one ay one ay one", "en"));
        expect(normalizeEnglish("a 5L jug")).toBe("a 5 liters jug");
    });

    /**
     * ⚠ ROMAN MARKERS ARE DELIBERATELY NOT CLAIMED, and this is pinned so it reads as a decision.
     * `(ii)` is wrong today, but the fix is not obviously "two": a letter series reaching `(i)` would
     * then read "one" while `(ii)` read "two", and a roman series whose `(i)` read "eye" is no better.
     * Either uniform choice is defensible; the MIXED one is worse than the defect.
     */
    test("a roman marker is left as it was", () => {
        expect(normalizeEnglish("(ii) two")).toBe("(ii) two");
        expect(normalizeEnglish("(iv) four")).toBe("(iv) four");
    });

    // ⚠ A SINGLE ⟨i⟩ IS CLAIMED as a letter, because it is a one-character marker like any other —
    // the roman reading is what is declined, not the letter.
    test("a single letter marker is claimed even when it looks roman", () => {
        expect(normalizeEnglish("(i) one")).toBe("eye, one");
    });
});

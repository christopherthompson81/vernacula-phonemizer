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
        ["(A) foo", "AY, foo"],       // ⚠ the substitution echoes the case it replaced
        ["(a) foo", "ay, foo"],
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
        expect(normalizeEnglish("P(A) = 1")).toBe("P(AY) equals 1");
        expect(normalizeEnglish("P(a) = 1")).toBe("P(ay) equals 1");
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
     * ⚠ THE CASE MUST SURVIVE, AND THIS IS THE FINDING THAT NEARLY SHIPPED. `LETTER_NAME(l.toLowerCase())`
     * is NOT a no-op for the other 24 letters — it returns the LOWERCASED input — and the initialism
     * pass decides SHOUTING with `!/\p{Ll}/.test(text)`, so one injected lowercase flips the verdict for
     * the WHOLE document. Measured: `SEE (B) OF US ARMY` became `SEE (b) OF US ARMY` and `US` was then
     * spelled out; `(X) IT AND US` read "eye-tee … you-ess". It is the identical hazard the `re-` rule
     * three steps above defends against by echoing the matched case.
     */
    test("an all-caps document keeps its case", () => {
        expect(normalizeEnglish("SEE (B) OF US ARMY")).toBe("SEE (B) OF US ARMY");
        expect(phonemize("SEE (B) OF US ARMY", "en")).toContain("\u02c8\u028cs");        // `US` the word
        expect(normalizeEnglish("(X) IT AND US")).toBe("X, IT AND US");
        expect(normalizeEnglish("(B) THE SECOND")).toBe("B, THE SECOND");
    });

    // ⚠ AND THE SUBSTITUTION ECHOES THE CASE IT REPLACED, so ⟨A⟩ does not lowercase the document either.
    test("the exception echoes the case it replaced", () => {
        expect(normalizeEnglish("(A) FOO BAR")).toBe("AY, FOO BAR");
        expect(normalizeEnglish("(a) foo bar")).toBe("ay, foo bar");
        expect(phonemize("(A) FOO BAR", "en")).toBe(phonemize("(a) foo bar", "en"));
    });

    // ⚠ THE SQUARE BRACKET IS A LIST STYLE TOO. The close class accepted `]` while the open class did
    // not, so `[a] foo` got the name but no pause and `[1] foo` nothing at all.
    test.each([["[a] foo", "ay, foo"], ["[1] foo", "1, foo"], ["[b] bar", "b, bar"]])(
        "%s", (text, expected) => expect(normalizeEnglish(text)).toBe(expected));

    /**
     * ⚠ A SINGLE CHARACTER IS A LETTER, INCLUDING ⟨i⟩, ⟨v⟩, ⟨x⟩ AND ⟨c⟩ — half the alphabet is also
     * a roman numeral, so refusing the roman-shaped ones would cost `(c)`, the third item of every
     * lettered list. `(i)` already read ˈaᶦ, which IS the letter name, so claiming it changes the
     * prosody and not the phones.
     *
     * ⚠ A MULTI-CHARACTER ROMAN MARKER IS LEFT ALONE, and the SEAM that leaves is pinned here on a
     * PAIR rather than on `(i)` alone — a test on one member cannot see a seam between two. An earlier
     * draft of the comment claimed roman markers were "deliberately not claimed", which the code
     * contradicted for the single-character case.
     */
    test("the roman seam is where it is said to be", () => {
        expect(normalizeEnglish("(i) one")).toBe("eye, one");        // claimed: a single character
        expect(normalizeEnglish("(ii) two")).toBe("(ii) two");       // left alone: multi-character
        expect(normalizeEnglish("See (i) and (ii) below.")).toBe("See (eye) and (ii) below.");
        // ⚠ and the PHONES of the single-character case are unchanged — only the prosody moves
        expect(phonemize("See (i) and (ii) below.", "en")).toContain("\u02c8a\u1da6");
    });
});

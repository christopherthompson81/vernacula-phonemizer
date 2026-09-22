/**
 * A hyphenated `re-` is the prefix, not the note of the scale (#1430).
 *
 * ⚠ THE SAME COLLISION AS THE `Re:` RULE at step 0b4, reached through a hyphen instead of a colon and
 * reported the same way — *"re-machined -> ray-machined"*. The hyphen makes `re` a token of its own and
 * CMUdict records the bare word as `R EY1`, so every hyphenated `re-` word took it.
 */
import { describe, expect, test } from "vitest";
import { normalizeEnglish } from "../src/languages/english/normalize.ts";
import { phonemize } from "../src/index.ts";

describe("a hyphenated re- is the prefix", () => {
    test.each(["re-machined", "re-measured", "re-entry", "re-work", "re-test", "re-examine"])(
        "%s reads /riː/", (w) => {
            expect(phonemize(w, "en")).toMatch(/^ɹˈiː /u);
            expect(phonemize(w, "en")).not.toMatch(/^ɹˈeᶦ/u);
        });

    test("in a frame", () => {
        expect(normalizeEnglish("a re-machined part")).toBe("a ree-machined part");
    });

    // ⚠ THE NOTE IS PROTECTED LEXICALLY, NOT POSITIONALLY — the guard asks whether the PRECEDING
    // hyphen-segment is a solfège syllable, not merely whether a hyphen precedes.
    test("the note of the scale is untouched", () => {
        expect(normalizeEnglish("do-re-mi")).toBe("do-re-mi");
        expect(normalizeEnglish("Do-Re-Mi")).toBe("Do-Re-Mi");
        expect(normalizeEnglish("sol-re-mi")).toBe("sol-re-mi");
        expect(phonemize("do-re-mi", "en")).toContain("ɹˈeᶦ");
        expect(normalizeEnglish("re")).toBe("re");
        expect(normalizeEnglish("Re: subject")).toBe("regarding subject");  // 0b4 still owns this
    });

    // ⚠ A POSITIONAL HYPHEN GUARD LEFT THE REPORTED DEFECT STANDING HERE. Refusing any preceding
    // hyphen kept `do-re-mi` but also suppressed the fix wherever `re-` legitimately follows one —
    // both of these read *ray* until the guard became lexical.
    test.each(["non-re-entrant", "pre-re-heat"])("%s is still the prefix", (w) => {
        expect(phonemize(w, "en")).toContain("ɹˈiː");
        expect(phonemize(w, "en")).not.toContain("ɹˈeᶦ");
    });

    // ⚠ THE PRECEDING SEGMENT, NOT THE FOLLOWING ONE, and this is the case that decides it: `re-do`
    // is an ordinary prefixed word whose SECOND element is a solfège syllable, so a following-segment
    // test would have read it as the note.
    test.each(["re-do", "re-mix"])("%s is the prefix, not the note", (w) =>
        expect(phonemize(w, "en")).toContain("ɹˈiː"));

    // ⚠ THE ACCEPTED COST, PINNED SO IT IS A DECISION AND NOT A SURPRISE: the note is protected only
    // when a solfège syllable PRECEDES it, so a sequence that opens on it still reads *ree*. Far rarer
    // than the hyphenated prefix, and not separable from it by shape.
    test("a solfege sequence that OPENS on re is not protected", () => {
        expect(normalizeEnglish("re-mi-fa-sol")).toBe("ree-mi-fa-sol");
    });

    // ⚠ A LETTER BEFORE IT IS SOMEONE ELSE'S `re`.
    test.each(["pre-machined", "core-machined", "genre-bending", "spare-part"])(
        "%s is untouched", (w) => expect(normalizeEnglish(w)).toBe(w));

    // ⚠ IT NEEDS A LETTER AFTER THE HYPHEN — a bare `re-` or `re-2` is not a prefixed word.
    test.each(["re-", "re-2"])("%s is untouched", (w) => expect(normalizeEnglish(w)).toBe(w));

    /**
     * ⚠ THE CASE IS ECHOED, AND THAT IS NOT COSMETIC. The initialism pass decides whether a document is
     * SHOUTING with `!/\p{Ll}/.test(text)`, so a lowercase `ree` injected into an all-caps document
     * flips that test and changes how every OTHER run in it is read. Measured before the echo went in:
     * `RE-WORK ORDER NHS` turned `ˌɛnˌeᶦt͡ʃˈɛs` — the fused, one-stress reading the initialism module
     * explicitly prefers — into three separate letter tokens.
     */
    test("an all-caps document stays as shouty as it was", () => {
        expect(normalizeEnglish("RE-MACHINED")).toBe("REE-MACHINED");
        expect(normalizeEnglish("Re-machined")).toBe("Ree-machined");
        // ⚠ The OTHER runs must read exactly as they did before this rule existed. These two values are
        // the pre-change readings, recorded from `main`: the fused, one-stress forms.
        expect(phonemize("RE-MACHINED NHS PARTS", "en")).toContain("ˌɛnˌeᶦt͡ʃˈɛs");
        expect(phonemize("RE-WORK ORDER NHS", "en")).toContain("ˌɛnˌeᶦt͡ʃˈɛs");
        expect(phonemize("RE-TESTED WD 40 SAMPLES", "en")).toContain("dˌʌbəɫjuːdˈiː");
    });

    // ⚠ THE UNHYPHENATED FORMS WERE ALREADY RIGHT, which is what says this is one lexical collision
    // rather than a gap in how prefixes are read.
    test("the joined spellings are unchanged", () => {
        expect(phonemize("rerun", "en")).toBe("ɹˌiːɹˈʌn");
        expect(normalizeEnglish("remeasured")).toBe("remeasured");
    });
});

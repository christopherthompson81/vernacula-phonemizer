/**
 * `makeUnreadableTest`'s LIQUID SIGNAL, across the scripts that wire it.
 *
 * ⚠ WHY THIS FILE EXISTS. Signal 2 of the readability test is "a consonant run of 3+ with no liquid to break
 * it up", and its liquid set was the ASCII class `/[lr]/u`. Cyrillic ⟨л⟩ and ⟨р⟩ do not match it, so for the
 * six Cyrillic languages that wire the test the signal could never be satisfied — every 3-consonant run was
 * unreadable, and the direction of the error is always MORE spelling-out. Playbook trap 1's family: a guard
 * written for one writing system is blind in another.
 *
 * The two halves below are the point. A test that only proved "the Cyrillic word reads now" would be half a
 * test: signals 3 and 4 (illegal onset, illegal coda) are what must still catch a REAL initialism once the
 * liquid stops condemning everything, and that is the half that could regress silently.
 *
 * Every fixture is a string from one of the six mined corpora, and these seven are the complete set whose
 * verdict the change flips — measured over every all-caps token in all six before it was made.
 */
import { describe, expect, test } from "vitest";

import { LIQUIDS, makeUnreadableTest } from "../src/core/initialisms.ts";
import { phonemize } from "../src/index.ts";

describe("the liquid signal knows more than ASCII", () => {
    test("the default set covers the Latin AND Cyrillic liquids", () => {
        for (const ch of ["l", "r", "л", "р"]) expect(LIQUIDS.test(ch), ch).toBe(true);
        // and nothing else — a liquid set that matched any letter would disable signal 2 everywhere
        for (const ch of ["b", "k", "б", "к", "ш"]) expect(LIQUIDS.test(ch), ch).toBe(false);
    });

    test("a language in an uncovered script can declare its own", () => {
        // `καλρβα` carries a THREE-consonant run (λρβ) whose first member is a liquid — the exact shape
        // signal 2 exists to let through. Everything else about the two tests is held identical.
        const V = /[αεηιουω]/u;
        const withoutOverride = makeUnreadableTest({ vowels: V, legalOnsets: new Set(), legalCodas: new Set() });
        const withOverride = makeUnreadableTest({
            vowels: V, legalOnsets: new Set(), legalCodas: new Set(), liquids: /[λρ]/u,
        });
        expect(withoutOverride("καλρβα"), "the default cannot see a Greek liquid").toBe(true);
        expect(withOverride("καλρβα"), "the declared set can").toBe(false);
        // and the override does not disable the signal — a run with no liquid still fires
        expect(withOverride("καβγδα")).toBe(true);
    });
});

describe("the seven strings whose verdict the fix flips — read through the real phonemizer", () => {
    // ORDINARY WORDS that were being spelled letter by letter. Both are corpus lines; the Mongolian one is an
    // everyday word inside a shouted title, which is how an all-caps run of ordinary text reaches this pass.
    test("an ordinary Cyrillic word is read as a word", () => {
        expect(phonemize("ХӨГЖЛИЙН", "mn").trim()).toBe("xɵɡt͡ʃɮiːŋ");
        expect(phonemize("ТҮРКСОЙ", "ky").trim()).toBe("tyrqsoj"); // TÜRKSOY, said as a word
    });

    // ⚠ THE HALF THAT MUST NOT REGRESS. These are genuine Soviet-era initialisms and must still be spelled
    // out; with signal 2 no longer condemning them, it is signals 3 and 4 that have to. If a later change to
    // the onset or coda tables lets one of these through, it reads as a nonsense word and no gate would see
    // it — that is the trap-56 shape, so the assertion is on the READING, not on the boolean.
    test("a real initialism is still spelled out, by the onset and coda signals", () => {
        expect(phonemize("ОСФСР", "ky").trim()).toBe("o es ef es er");
        expect(phonemize("АЖРВТ", "tg").trim()).toBe("ˈa ʒˈe rˈe vˈe tˈe");
        expect(phonemize("РХФЮ", "tg").trim()).toBe("rˈe χˈe fˈe jˈu");
        expect(phonemize("РСФЮ", "tg").trim()).toBe("rˈe sˈe fˈe jˈu");
        expect(phonemize("ҶФШСР", "tg").trim()).toBe("d͡ʒˈe fˈe ʃˈe sˈe rˈe");
    });
});

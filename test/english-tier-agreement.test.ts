/**
 * ENGLISH KEEPS ITS OWN COPY OF THE SYMBOL TIER, AND THIS IS THE GATE ON THE DUPLICATION (#1086).
 *
 * `english/normalize.ts` states the separation as a fact and gives no reason. The reason is in the code, in
 * step 6's own note: "English keeps its own UNITS table (**this normalizer predates that layer**)". It is an
 * accident of order-of-writing, not a design decision.
 *
 * ⚠ THE DUPLICATION HAS COST TWICE. #763 (an uppercase unit key unreachable, and the assertion made the miss
 * a THROW) and #1045 (the seconds prime and the nuclide) each had to be fixed in both places — and #1045 was
 * worse than a repeat, because English needed a THIRD change the core did not: its glued pass fired first
 * and inserted a space that hid the nuclide from a guard testing for a letter immediately after. The two
 * implementations have diverged in ORDERING, so a fix correct for one was incomplete for the other.
 *
 * ⚠ WRITING THIS TEST FOUND A LIVE DEFECT IN #1085, THE FIX IT WAS AUDITING. Core's DECLARED branch still
 * read `0,708 ¹⁸⁰Hf` as a power, because core's own glued pass defeated the guard there — the same
 * interaction, unfixed in core. See `docs/investigations/english_symbol_tier_investigation.md`.
 *
 * So this asserts the two agree on the shapes they both claim, with the known differences pinned as
 * expected rather than papered over. A third divergence fails here before it ships.
 */
import { describe, expect, test } from "vitest";

import { makeSymbolNormalizer, type SymbolData } from "../src/core/normalizeSymbols.ts";
import { normalizeEnglish } from "../src/languages/english/normalize.ts";

/**
 * The tier configured from English's OWN readings. ⚠ The values are TEMPLATES — three earlier attempts to
 * write this by hand passed bare words and produced a tier that dropped the base entirely, which looked
 * like a divergence and was a misconfiguration. A probe that exercises the wrong branch is not a weaker
 * test, it is a test of something else.
 */
const asEnglish = makeSymbolNormalizer({
    bareExponent: {
        squared: "{n} squared",
        cubed: "{n} cubed",
        power: "{n} to the power of {e}",
        negative: "negative",
    },
} as SymbolData);

/** Shapes both implementations claim, where they must agree exactly. */
const AGREE = [
    "20²", "8³", "2¹⁰", "10⁶", "x⁷", "5²", "10¹⁰⁰",
    "2⁻⁵", "10⁻¹⁹", //                    the negative exponent, and its word is "negative" in both
    "I²C", "10⁶km", //                    the glued cases the spacing pass exists for
    "110⁰04¹05¹¹", "0,708 ¹⁸⁰Hf", //      #1045's two shapes — declined by both
    "360⁰", "10¹⁰ 10¹¹", //               the lone mark, and two powers with a ⁰ in reach
];

describe("English's local exponent pass and the shared tier agree (#1086)", () => {
    for (const probe of AGREE)
        test(`${JSON.stringify(probe)}`, () => {
            expect(asEnglish(probe), "core tier configured as English").toBe(normalizeEnglish(probe));
        });

    // ⚠ THE KNOWN DIFFERENCES, PINNED. Neither is an exponent-arm disagreement, and pinning them is what
    // keeps this test honest: an assertion list that quietly excluded them would report agreement it has
    // not earned. If either changes, that is news either way.
    test("⚠ the base class differs, and that is a real choice rather than an accident", () => {
        // Core admits any letter base (`[\p{L}\p{M}]{1,3}`); English admits ASCII only (`[A-Za-z]{1,3}`).
        // Which is right for English is its own question — a Greek-letter base is a physics variable, and
        // English's OOV path may serve it better than a spoken "omega squared".
        expect(asEnglish("Ω²")).toBe("Ω squared");
        expect(normalizeEnglish("Ω²")).toBe("Ω²");
    });

    test("⚠ `=` is an English-only feature, not an exponent disagreement", () => {
        // English expands the relational sign; the tier as configured here declares none. Both read the
        // exponent identically — the difference is entirely the word "equals".
        expect(asEnglish("E = mc²")).toBe("E = mc squared");
        expect(normalizeEnglish("E = mc²")).toBe("E equals mc squared");
    });
});

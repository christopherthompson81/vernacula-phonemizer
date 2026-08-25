/**
 * U+2212 MINUS SIGN — the nine languages that read the ASCII hyphen as a minus and dropped the real one.
 *
 * ⚠ THE CHARACTER IS THE EVIDENCE. U+2212's only Unicode meaning is the arithmetic operator and no keyboard
 * types it by accident, so it is read on the character's identity rather than on corpus attestation — it is
 * ×0 in all nine mined corpora and ×0 in every golden, which is exactly why the reading could go missing
 * without a single test or golden row noticing. Dropping a minus INVERTS the value it belongs to.
 *
 * ⚠ WHAT THIS DOES NOT CLAIM. The character says a minus was MEANT; it says nothing about the structure of
 * the expression. The fleet's corpus has `×10 −31 kg` (a flattened negative exponent), `90 −120` (a range),
 * and `занҳо −76,2` (an apposition dash), all U+2212. So the guards are unchanged: leading position only.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";

/** Every language here already read `-5` and dropped `−5`. The pair is the assertion. */
const NINE = ["af", "az", "ca", "cy", "ff", "ga", "ha", "kk", "kmr"] as const;

describe.each(NINE)("%s reads U+2212 exactly as it reads the ASCII hyphen", (code) => {
    test("a leading minus before a bare number", () => {
        const hyphen = phonemize("-5", code);
        expect(phonemize("−5", code), `${code}: U+2212 dropped`).toBe(hyphen);
        // ⚠ AND IT MUST NOT BE THE BARE NUMBER — an assertion that only compared the two spellings would
        // pass just as well if BOTH had silently stopped reading the sign.
        expect(hyphen).not.toBe(phonemize("5", code));
    });

    test("a negative temperature", () => {
        expect(phonemize("−5 °C", code)).toBe(phonemize("-5 °C", code));
    });

    test("a digit−digit RANGE is still refused", () => {
        // The lookbehind rejects a preceding digit, so a lifespan is not read as a subtraction (#955).
        expect(phonemize("1838−1917", code)).toBe(phonemize("1838 1917", code));
    });

    test("a negative exponent written digit−digit is still refused", () => {
        expect(phonemize("10−19", code)).toBe(phonemize("10 19", code));
    });
});

/**
 * ⚠ KURMANJI HAD FOUR ARMS AND THE FIRST PASS FIXED ONE — which the tests above caught, because the pair
 * assertion is symmetric and an asymmetry anywhere fails it. Its minus is claimed by a temperature rule, a
 * bare-degree rule, a `pile`-phrase rule and a string-START rule, each written with an ASCII hyphen, so
 * `−5` stayed silent while `-5` read. Widening the character class in all four does not widen any trigger:
 * a minus MID-STRING before a bare number is still refused here, deliberately, and for both spellings —
 * kurmanji measured ~22 dashes before a digit and found only the ten temperatures genuine.
 */
describe("kmr keeps its narrow trigger, for both spellings alike", () => {
    test("a minus mid-string before a bare number is claimed by neither spelling", () => {
        expect(phonemize("heta −5", "kmr")).toBe(phonemize("heta 5", "kmr"));
        expect(phonemize("heta -5", "kmr")).toBe(phonemize("heta 5", "kmr"));
    });
});

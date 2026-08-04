/**
 * THE ACCEPTED-SILENT BASELINE (#586) — proof that it is a baseline and not a quiet gate.
 *
 * `defects.ts` records the judgement that a spaced designation cannot be told from a real negative by pattern
 * (`चंद्रयान -1` and `-5 stupňů` are the same shape) and that "a quiet gate would be worse". So the sweep's
 * permanent residual is accepted BY IDENTITY — the literal designation strings — and these tests pin the two
 * properties that make that safe. If either fails, the audit has started hiding real defects.
 */
import { describe, expect, test } from "vitest";
import { ACCEPTED_SILENT, DROPPABLE, isAcceptedSilent } from "../tools/normalization/defects.ts";

const MINUS = DROPPABLE.find(([n]) => n === "minus")![1];

describe("ACCEPTED_SILENT is a baseline, not a suppression", () => {
    test("the five named designations are accepted", () => {
        expect(isAcceptedSilent("hi", "minus", "लूनर ऑर्बिट चंद्रयान -1 ने अपने मून", MINUS)).toBe(true);
        expect(isAcceptedSilent("mr", "minus", "चंद्र कक्षा चंद्रयान -1 ने त्याचा", MINUS)).toBe(true);
        expect(isAcceptedSilent("ta", "minus", "சுற்றுப்பாதை சந்திரயான் -1 செயற்கைக்கோள்", MINUS)).toBe(true);
        expect(isAcceptedSilent("gu", "minus", "રહેવા માટે એચજેઆર -3 ની આગામી", MINUS)).toBe(true);
        expect(isAcceptedSilent("kn", "minus", "ಮತ್ತೆ ಎಚ್‌ಜೆಆರ್ -3 ಅನ್ನು ಪರಿಶೀಲಿಸುತ್ತದೆ", MINUS)).toBe(true);
    });

    test("⚠ A REAL NEGATIVE IN THE SAME SENTENCE STILL REPORTS", () => {
        // The accept is per-OCCURRENCE: every match must fall inside a named span, so a designation cannot
        // launder a genuine minus that happens to share its sentence. hi's one true negative in the whole
        // fleet is exactly this shape, which is what makes the property load-bearing rather than theoretical.
        expect(isAcceptedSilent("hi", "minus", "चंद्रयान -1 ने और -२.८८ परिमाण", MINUS)).toBe(false);
        expect(isAcceptedSilent("hi", "minus", "तापमान -5 डिग्री", MINUS)).toBe(false);
    });

    test("⚠ AN UNLISTED DESIGNATION STILL REPORTS — nothing is suppressed by SHAPE", () => {
        // Same shape as the accepted ones (word, space, dash, digit) and deliberately not accepted: a sixth
        // designation, or one of these in a new language, must surface for a human judgement.
        expect(isAcceptedSilent("hi", "minus", "मिशन मंगलयान -2 ने", MINUS)).toBe(false);
        expect(isAcceptedSilent("te", "minus", "చంద్రయాన్ -1 ఉపగ్రహం", MINUS)).toBe(false);
        expect(isAcceptedSilent("bn", "minus", "চন্দ্রযান -1 এর", MINUS)).toBe(false);
    });

    test("a language that names nothing accepts nothing, and only `minus` is in scope", () => {
        expect(isAcceptedSilent("de", "minus", "Temperatur -5 Grad", MINUS)).toBe(false);
        // The table is keyed to the minus class only; no other class may borrow it.
        expect(isAcceptedSilent("hi", "currency", "चंद्रयान -1 ने", MINUS)).toBe(false);
    });

    test("a sentence with no match at all is not vacuously accepted", () => {
        // `sawOne` guards this: an empty match set must not count as "every match is fine".
        expect(isAcceptedSilent("hi", "minus", "कोई संख्या नहीं", MINUS)).toBe(false);
    });

    test("the table is exactly the five languages the sweep resolved", () => {
        expect(Object.keys(ACCEPTED_SILENT).sort()).toEqual(["gu", "hi", "kn", "mr", "ta"]);
        // Two universal sentences, one designation each — FLEURS translates ONE English set.
        for (const forms of Object.values(ACCEPTED_SILENT)) expect(forms).toHaveLength(1);
    });
});

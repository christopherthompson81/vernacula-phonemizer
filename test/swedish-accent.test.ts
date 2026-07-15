import { describe, expect, it } from "vitest";
import { evaluateAccent } from "../tools/sv-accent-eval.mts";

/**
 * Swedish tonal word-accent (1/2) regression floor vs wikipron — an INDEPENDENT source (English Wiktionary) of our
 * NST-derived accent lexicon. Accent 2 is rendered as a combining grave on the primary-stressed vowel. Homographs
 * (anden, buren) are excluded (single-reading ambiguity). Like Japanese pitch, Swedish accent is an inherent ~95%
 * task where two independent lexica disagree on the contested tail; accent-2 (the reliably-marked class) is the
 * strong signal. Floors sit below the measured value to catch a real regression (a lexicon or grave-rendering break).
 */
describe("Swedish tonal accent (1/2) vs wikipron", () => {
    const r = evaluateAccent();
    it("compares a substantial non-homograph accent-marked sample", () => {
        expect(r.compared).toBeGreaterThan(1000);
    });
    it("overall accent agreement stays ≥ 94% (measured ~96.6%)", () => {
        expect(r.agree / r.compared).toBeGreaterThan(0.94);
    });
    it("accent-2 recall (reliably-marked class) stays ≥ 96% (measured ~98%)", () => {
        expect(r.a2ok / r.a2).toBeGreaterThan(0.96);
    });
});

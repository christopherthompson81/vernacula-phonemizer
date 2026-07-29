import { describe, expect, it } from "vitest";
import { evaluatePitch } from "../tools/eval/ja-pitch-eval.mts";

/**
 * Japanese pitch-accent (downstep ꜜ) regression floor vs OpenJTalk. OpenJTalk is one of the three voters behind
 * our merged pitch lexicon, so this is a conservative-but-not-fully-independent referee (no larger free Tokyo
 * accent source exists — kaikki/Wiktionary carries ~3 Tokyo words). JA accent is an inherent ~90-95% task
 * (dictionaries disagree: 映画 0/1, 期間 1/2), so the ~96% measured is near ceiling; the residual is contested
 * accents + verb-stem-fragment artifacts. Floor sits below the measured value to catch a real regression (a
 * lexicon-coverage drop or a placeDownstep/accentNucleus break) without tripping on ordinary churn.
 */
describe("Japanese pitch accent vs OpenJTalk (near-ceiling floor)", () => {
    const r = evaluatePitch();
    it("compares a substantial matched-reading, mora-aligned sample", () => {
        expect(r.compared).toBeGreaterThan(1800);
    });
    it("accent-nucleus agreement stays ≥ 94% (measured ~96%)", () => {
        expect(r.agree / r.compared).toBeGreaterThan(0.94);
    });
    it("OOV-heiban coincidences stay low (pitch-lexicon coverage guard)", () => {
        expect(r.oovHeibanAgree).toBeLessThan(40);
    });
});

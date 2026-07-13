import { describe, expect, it } from "vitest";
import { evaluate } from "./eval.ts";
import { CONFIG } from "./config.ts";

/**
 * Independent-referee corroboration floors. Each phonemizer's SEGMENTAL BACKBONE must still agree with its
 * PRIMARY espeak-independent source (epitran / wikipron / kaikki) above a floor — a linguistic-correctness
 * regression guard, distinct from the espeak-canonical gold (which only guards accidental drift from our
 * bootstrap). Secondary sources are reported by eval.ts as corroboration but not floored here. Floors sit below
 * the current measured agreement so ordinary churn doesn't trip them; a real regression (or a fold that stops
 * applying) drops below. Raise a floor deliberately when the engine improves. Languages with no viable
 * independent referee are recorded as gaps (asserted below), not silently skipped.
 */
describe("referee corroboration (segmental backbone vs the PRIMARY independent source)", () => {
  // Floor = the primary referee's folded-agreement fraction, set below the measured value. Alphabetical.
  const floors: Record<string, number> = {
    ar: 0.40, // wikipron ara via the async ONNX diacritizer — measured 45.4%; residual = diacritizer short-vowel misses
    cmn: 0.80, // epitran pinyin-syllable inventory (syllable-level) — measured 84.7%; residual = fine vowel detail
    cs: 0.65, // epitran ces-Latn — measured 69.9%; DEFLATED by epitran's own voicing bugs (pr→br, tr→dr, s→z)
    de: 0.46, // kaikki deu — measured 49.8% (wikipron deu 2nd: 52.2%); DEFLATED by kaikki's proper-noun/loan bulk
    es: 0.88, // wikipron spa_latn_ca — measured 92.5%; residual is loanwords + diphthong-offglide notation
    fr: 0.62, // wikipron fra — measured 66.5% (adjudicated gold 2nd: 85.6%); primary DEFLATED by wikipron noise
    kk: 0.83, // epitran kaz-Cyrl — measured 86.2%; residual is largely epitran's own ө/ү merger + palatalization
    pt: 0.74, // wikipron por — measured 78.0% (adjudicated gold 2nd: 99.4%); residual is open/close vowels
    ru: 0.90, // kaikki rus — measured 94.8% (adjudicated gold 2nd: 97.7%)
    si: 0.90, // wikipron sin (human) — measured 93.5%; residual is 1× referee quirks
    zu: 0.99, // epitran zul-Latn — clicks/implosives/ejectives/laterals corroborated (measured 100%)
  };
  for (const [lang, floor] of Object.entries(floors)) {
    it(`${lang} backbone ≥ ${(floor * 100).toFixed(0)}% of its primary referee`, async () => {
      const primary = (await evaluate(lang)).find((r) => r.role === "primary");
      expect(primary, `${lang} has no primary referee result`).toBeDefined();
      const frac = primary!.folded / primary!.total;
      expect(frac, `${lang} vs ${primary!.source}: ${primary!.folded}/${primary!.total}`).toBeGreaterThanOrEqual(floor);
    });
  }

  // Languages with no viable independent referee must RECORD the gap (not silently omit it).
  it("gap languages document why they have no independent referee", () => {
    for (const [lang, cfg] of Object.entries(CONFIG)) {
      if (cfg.referees.length === 0) {
        expect(cfg.secondaryGap, `${lang} has no referees but no documented gap`).toBeTruthy();
      }
    }
  });
});

import { describe, expect, it } from "vitest";
import { evaluate } from "./eval.ts";

/**
 * Independent-referee corroboration floors. These assert that each phonemizer's SEGMENTAL BACKBONE still agrees
 * with an espeak-INDEPENDENT source (epitran / wikipron) above a floor — a linguistic-correctness regression
 * guard, distinct from the espeak-canonical gold (which only guards against accidental drift from our bootstrap).
 * Floors are set below the current measured agreement so ordinary churn doesn't trip them; a real regression
 * (or a fold that stops applying) drops below. Raise a floor deliberately when the engine improves.
 */
describe("referee corroboration (segmental backbone vs independent sources)", () => {
  const floors: Record<string, number> = {
    zu: 0.99, // epitran zul-Latn — clicks/implosives/ejectives/laterals corroborated (measured 100%)
    si: 0.90, // wikipron sin (human) — measured 93.5%; residual is 1× referee quirks
    kk: 0.83, // epitran kaz-Cyrl — measured 86.2%; residual is largely epitran's own ө/ү merger + palatalization
  };
  for (const [lang, floor] of Object.entries(floors)) {
    it(`${lang} backbone ≥ ${(floor * 100).toFixed(0)}% of an independent referee`, () => {
      for (const r of evaluate(lang)) {
        const frac = r.folded / r.total;
        expect(frac, `${lang} vs ${r.source}: ${r.folded}/${r.total}`).toBeGreaterThanOrEqual(floor);
      }
    });
  }
});

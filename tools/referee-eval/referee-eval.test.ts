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
    ar: 0.55, // wikipron ara via the ONNX diacritizer + LEXICON-PRIMARY Tashkeela restoration + PAUSAL fold — measured 57.4% (kaikki 2nd: 62.6%). Referee is isolated citation-form lemmas (OOD + convention + ambiguity); see docs/ar_referee_investigation.md
    ca: 0.76, // wikipron cat_latn narrow (Central-preferring, multi-dialect) — measured 81.3%; referee mixes dialects (reduction/final-r/clusters folded) + no stress
    cmn: 0.80, // epitran pinyin-syllable inventory (syllable-level) — measured 84.7%; residual = fine vowel detail
    cs: 0.95, // wikipron ces_latn (HUMAN) — 97.0% with the kaikki loanword lexicon (de-palatalization: stadion/studie/technik). Rule-engine OOV alone 97.7% (independent). Partly circular for the 404 dict-covered (kaikki~wikipron both Wiktionary)
    cy: 0.80, // wikipron cym_latn NW — 83.7% WITH the kaikki NW lexicon (ae quality/oe length/dim/y-obscure, referee-confirmed → PARTLY CIRCULAR). Rule-engine OOV alone 81.1% (independent).
    de: 0.75, // kaikki deu — measured 76.1% (wikipron deu 2nd: 74.9%); Run 27 glided unstressed i in medial hiatus (Latinate -iVC-: genial, union, aluminium). Residual now DOMINATED by proper-noun/loanword noise (haiti/alert/berlin/moslem) — the referee-limited tail
    en: 0.30, // wikipron eng_us — measured 36.1%; DEFLATED by a noisy referee (proper nouns, GB variants, letter-names)
    es: 0.88, // wikipron spa_latn_ca — measured 92.5%; residual is loanwords + diphthong-offglide notation
    ff: 0.62, // epitran ful-Latn — measured 71.2%; residual = epitran nj→ɲ vs our prenasal + salt
    fr: 0.76, // wikipron fra — 79.1% (adjudicated gold 91.3%); ✅ referee name/acronym-limited (92.5% common-word). Full loi de position: o/ɔ default + au/eau+r→ɔ + o-before-z→o + x-closes; e/ɛ-before-cluster kept lexical (Lexique). Headline deflated by proper-name/acronym/rare tail
    ga: 0.40, // wikipron gle_latn broad — measured 44.8% (Run-3 referee-gated lexicon); 3-DIALECT referee (~34% ceiling even for a mature engine), vowel-noise dominated
    ha: 0.85, // wikipron hau (human) — measured 90.3% (epitran hau 2nd: 88.4%)
    hi: 0.72, // wikipron hin — measured 77.7%; residual = schwa-deletion edge cases + ref epenthesis + genuine ख़/ख (x/kʰ) noise
    ja: 0.52, // wikipron jpn_hira narrow — measured 57.9%; residual = allophonic palatalization + devoicing detail
    kk: 0.83, // epitran kaz-Cyrl — measured 86.2%; residual is largely epitran's own ө/ү merger + palatalization
    ko: 0.52, // wikipron kor_hang narrow — measured 58.5%; residual = ㄹ (ɭ~ɾ) + intervocalic voicing detail
    pt: 0.80, // wikipron por — 81.2% (adjudicated gold 2nd: 99.4%); ✅ referee register/name-limited after dark-l blocks a/e reduction (salvar→saɫvaɾ 53:0, -vel→vɛɫ 89:0). Residual one-directional: we reduce EP pretonic o→u/e→ɨ uniformly, referee keeps mid in learned words (195:0 / 386:8)
    ru: 0.90, // kaikki rus — measured 94.8% (adjudicated gold 2nd: 97.7%)
    si: 0.90, // wikipron sin (human) — measured 93.5%; residual is 1× referee quirks
    sv: 0.52, // wikipron swe broad — measured 55.7% (Phase 3: + NST compound secondary-stress → boundary-safe vowel length/quality + 2nd-onset softening); residual = referee noise (casual/truncated forms)
    ta: 0.58, // wikipron tam — measured 63.0% (r→ɾ folded only word-finally, to keep the ற/ர contrast); residual = ற geminate + diphthong notation
    th: 0.76, // wikipron tha — measured 81.9%; residual is LEXICAL (Sanskrit/Pali readings), not segmental
    tr: 0.70, // wikipron tur — measured 76.2% (epitran tur 2nd: 79.8%); residual = loan long-vowels + ref noise
    vi: 0.65, // wikipron vie_hanoi narrow — measured 71.0% (epitran vie 2nd: 51.3%); residual = ə/ɛ nucleus + coda
    zu: 0.99, // epitran zul-Latn — clicks/implosives/ejectives/laterals corroborated (measured 100%)
  };
  for (const [lang, floor] of Object.entries(floors)) {
    it(`${lang} backbone ≥ ${(floor * 100).toFixed(0)}% of its primary referee`, async () => {
      const primary = (await evaluate(lang, true)).find((r) => r.role === "primary");
      expect(primary, `${lang} has no primary referee result`).toBeDefined();
      const frac = primary!.folded / primary!.total;
      expect(frac, `${lang} vs ${primary!.source}: ${primary!.folded}/${primary!.total}`).toBeGreaterThanOrEqual(floor);
    }, 30000); // ONNX diacritizer (ar) is slow; generous per-test timeout
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

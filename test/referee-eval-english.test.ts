/**
 * The two English referee floors, SPLIT OUT OF referee-eval.test.ts FOR WALL TIME ONLY — same gate,
 * same `evaluate` call, same sampled path, same floors. Nothing about what is measured changes.
 *
 * ⚠ VITEST SCHEDULES WHOLE FILES TO WORKERS, so one long file is a floor under the whole suite no
 * matter how many cores are free. `en` (11.8s) and `en-GB` (16.4s) were 28s of referee-eval's 51s,
 * and that file was 51s of a 70s suite — the other 171 languages together cost 23s. Measured:
 *
 *                                      wall
 *   suite, one referee file            70s
 *   suite, split as it is now          see the header of referee-eval.test.ts
 *
 * They are slow for a reason worth keeping: both run the referee through the NEURAL English G2P,
 * which is 9ms a word, and both referees are large (en-GB's is 76,284 rows, stride-sampled to
 * 3,000). The cost is the BiLSTM, not the eval.
 *
 * ⚠ KEEP THE `NEURAL` SAMPLE CAP IN STEP WITH THE OTHER FILE. Both files call
 * `evaluate(lang, true, 3000)` for these two, and en-GB's floor is documented as set against the
 * SAMPLED path — 0.44 against a measured 45.4%, ~1pp of margin. Changing the cap in one file only
 * would move the number the floor was chosen for.
 */
import { describe, expect, it } from "vitest";
import { evaluate } from "../tools/referee-eval/eval.ts";
import { capFor } from "./referee-sample.ts";

describe("referee corroboration — English (split out for wall time)", () => {
    const floors: Record<string, number> = {
        en: 0.5, // wikipron eng_us. ⚠ RAISED FROM 0.35, WHICH HAD STOPPED BEING A GATE: #1327 and #1328 moved the INSTRUMENT (not the engine) from 40.9% to 56.1% by adding three missing convention folds, scoring the neural tier that actually ships, and dropping 488 RP rows from a referee labelled GenAm — so 0.35 sat 20pp below the measurement and would not have caught a regression of any size. Sampled now 59.8% (1209/2023), RAISED AGAIN TO 0.50 by #1334, which corrected 330 dict rows where wikipron and misaki gold agree against CMUdict (and where our own dict contradicted itself across a morphological family). ⚠ THE FLOOR IS BELOW THE DEGRADED-PATH SCORE ON PURPOSE: with onnxruntime unavailable `phonemizeEnNeural` falls back to the sync engine, which measures 53.4% on the full referee (50.0% before #1334 — the dictionary corrections are lexicon-level, so they lift BOTH paths, which is why the floor could move with them). So this floor survives an ONNX-less environment with 3.4pp to spare, and a result near 53% rather than 60% is the signature of that fallback rather than of a regression. ⚠ IT CANNOT SIMPLY TRACK THE SHIPPED NUMBER: 0.59 would be tighter against the neural path and would fail every ONNX-less checkout. Previously documented as "measured 41.8%", which was the pre-#1327 instrument. #1282's ᵻ→ɪ fold is worth +1.8pp of it: the referee has no ᵻ, so leaving it unfolded scored the house weak-vowel convention as ALWAYS-WRONG across 5,580 lexicon rows and made a CORRECT change (#1275's -es plural) cost 7 words. ⚠ THE FOLD HIDES WHETHER ᵻ IS PLACED CORRECTLY — that axis lives in tools/english/en_weak_vowel_survey.mts; run it when isBarredI changes.
        "en-GB": 0.51, // British English (SSBE/"BBC") — an ACCENT VARIANT of `en`: the GenAm engine + an RP lexical-set delta (english-gb.ts, toRP). wikipron eng_latn_uk (PRIMARY, HUMAN, NARROW, 76,284 rows — ⚠ 74,843 SCORED since #1404 excluded 1,441 US-contaminated rows whose EVERY reading is rhotic, which a non-rhotic engine passes 0 of; the numerator did not move, so the headline rose 52.9% → 53.9% purely by shedding guaranteed failures) measured 46.4% RULE-ONLY (phonemizeWordRules, no lexical sets → non-circular) on the FULL referee — 44.0% before #1282's ᵻ→ɪ fold, +1,828 words. ⚠ THE FLOOR IS SET AGAINST THE SAMPLED PATH, NOT THAT NUMBER: this gate calls evaluate() with a 3,000-row stride sample, which measured 45.4% when the floor was first set and measures 53.9% now (1613/2994). ⚠ RAISED 0.44 → 0.51 IN #1404, because 0.44 had become the dead gate the `en` note below describes: it left 9.9pp. Two things had moved it and the comment had tracked neither — the quoted 1365/2934 was already stale (the real figure on the previous tree was 1494/2934 = 50.9%), and #1404's exclusion changes the SAMPLE ITSELF, not just the score: the stride is ceil(rows/3000), so dropping 1,441 rows takes it 26 → 25 and the gate now scores 2,994 DIFFERENT rows. referee-sample.ts says a different cap is a different measurement; a different denominator is too. 0.51 restores the ~2.9pp this repo sets floors at. REFEREE-NOISE-LIMITED exactly like `en`'s own 41.8%: the 76k list is dominated by rare/proper/foreign words the SHARED OOV G2P model mangles (a `en`-engine weakness, not the accent delta). The real quality anchor is the 91-word hand-adjudicated DIAGNOSTIC GOLD (test/english-gb.test.ts, RP from Wells's lexical sets, NOT mined) = 100%: verifies non-rhoticity (car→kʰɑː, letter→lɛtə, linking-r different→dɪfəɹənt), BATH æ→ɑː (bath/dance/grass), CLOTH/LOT ɒ (off/dog/gone), NURSE ɜː, GOAT əᶷ, centring ɪə/ɛə/ʊə (near/square/cure), yod-retention Cjuː (new/student/enthusiasm), PALM exceptions (father/spa/drama). The SHIPPED phonemizeWord adds BATH/CLOTH/yod/PALM/LOTR word lists MINED from this referee (~41%, circular → not the headline). Folds: aspiration ʰ, dark ɫ~l, ɐ~ə, ɜ~ə, and the FIVE CLOSING DIPHTHONGS — əᶷ~əʊ, eᶦ~eɪ, aᶦ~aɪ, aᶷ~aʊ, ɔᶦ~ɔɪ (#1252: en-GB writes the parent's superscript offglide, the referee writes two full vowels; the same five `en.jsonc` carries). ⚠ THOSE FIVE ARE LOAD-BEARING FOR THIS FLOOR, not cosmetic — the eval does NOT strip modifier letters on its own, so without them the SAME output scores 26.8% folded / 76.2% symbol and blows straight through this floor. Measured, both ways. DEFERRED: yod-COALESCENCE after /t d/ (tube→t͡ʃuːb, duke→d͡ʒuːk) + idiosyncratic US/UK lexical vowel swaps (tomato/pasta). accent-variant.
    };

    // ⚠ THE CAP COMES FROM referee-sample.ts, the same module referee-eval.test.ts reads. It used to
    // be the literal 3000 in both files with a comment asking the reader to keep them in step; the
    // floors were chosen against this exact sample, so an import is the only thing that guarantees it.
    for (const [lang, floor] of Object.entries(floors)) {
        it(`${lang} backbone ≥ ${(floor * 100).toFixed(0)}% of its primary referee`, async () => {
            const primary = (await evaluate(lang, true, capFor(lang))).find((r) => r.role === "primary");
            expect(primary, `${lang}: no primary referee result`).toBeDefined();
            const got = primary!.folded / primary!.total;
            expect(got, `${lang} folded agreement ${(got * 100).toFixed(1)}% < floor ${(floor * 100).toFixed(0)}%`)
                .toBeGreaterThanOrEqual(floor);
        // ⚠ THE SPLIT DROPPED THIS AND IT TOOK A YEAR-SHAPED DETOUR TO NOTICE. referee-eval.test.ts —
        // the file this was carved out of, "for wall time only, same gate" — passes 120000 here, for
        // the reason documented beside it: these tests are 8× under the default when idle and a loaded
        // machine eats exactly that headroom. Carving out the two English cases took the floors and the
        // `evaluate` call and left the timeout behind, so this file has been running on vitest's 5s
        // default ever since. `en` measures 2.2s alone and timed out at 5s inside a full parallel run —
        // twice — which reads as a score regression in the reporter and is not one. Same value, same
        // reason; a floor suite that cries wolf is one a reader stops believing.
        }, 120000);
    }
});

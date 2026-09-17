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
        en: 0.35, // wikipron eng_us — measured 41.8%, of which +1.8pp is #1282's ᵻ→ɪ fold: the referee's inventory has no ᵻ, so leaving it unfolded scored the house weak-vowel convention as ALWAYS-WRONG across 5,580 lexicon rows and made a CORRECT change (#1275's -es plural) cost 7 words. ⚠ THE FOLD HIDES WHETHER ᵻ IS PLACED CORRECTLY — this referee partially resolves it (our ᵻ draws ɪ 72.9%/ə 19.5%, our full ɪ draws 91.2%/4.2%, on 118 slots over 1,929 aligned words), so that axis lives in tools/english/en_weak_vowel_survey.mts instead; run it when isBarredI changes. Still DEFLATED by a noisy referee (proper nouns, GB variants, letter-names).
        "en-GB": 0.44, // British English (SSBE/"BBC") — an ACCENT VARIANT of `en`: the GenAm engine + an RP lexical-set delta (english-gb.ts, toRP). wikipron eng_latn_uk (PRIMARY, HUMAN, NARROW, 76284) measured 46.4% RULE-ONLY (phonemizeWordRules, no lexical sets → non-circular) on the FULL referee — 44.0% before #1282's ᵻ→ɪ fold, +1,828 words. ⚠ THE FLOOR IS SET AGAINST THE SAMPLED PATH, NOT THAT NUMBER: this gate calls evaluate() with a 3,000-row stride sample for the NEURAL languages, which measures 45.4% — so 0.44 leaves ~1pp, where 0.45 would have left 13 words. REFEREE-NOISE-LIMITED exactly like `en`'s own 41.8%: the 76k list is dominated by rare/proper/foreign words the SHARED OOV G2P model mangles (a `en`-engine weakness, not the accent delta). The real quality anchor is the 91-word hand-adjudicated DIAGNOSTIC GOLD (test/english-gb.test.ts, RP from Wells's lexical sets, NOT mined) = 100%: verifies non-rhoticity (car→kʰɑː, letter→lɛtə, linking-r different→dɪfəɹənt), BATH æ→ɑː (bath/dance/grass), CLOTH/LOT ɒ (off/dog/gone), NURSE ɜː, GOAT əᶷ, centring ɪə/ɛə/ʊə (near/square/cure), yod-retention Cjuː (new/student/enthusiasm), PALM exceptions (father/spa/drama). The SHIPPED phonemizeWord adds BATH/CLOTH/yod/PALM/LOTR word lists MINED from this referee (~41%, circular → not the headline). Folds: aspiration ʰ, dark ɫ~l, ɐ~ə, ɜ~ə, and the FIVE CLOSING DIPHTHONGS — əᶷ~əʊ, eᶦ~eɪ, aᶦ~aɪ, aᶷ~aʊ, ɔᶦ~ɔɪ (#1252: en-GB writes the parent's superscript offglide, the referee writes two full vowels; the same five `en.jsonc` carries). ⚠ THOSE FIVE ARE LOAD-BEARING FOR THIS FLOOR, not cosmetic — the eval does NOT strip modifier letters on its own, so without them the SAME output scores 26.8% folded / 76.2% symbol and blows straight through this floor. Measured, both ways. DEFERRED: yod-COALESCENCE after /t d/ (tube→t͡ʃuːb, duke→d͡ʒuːk) + idiosyncratic US/UK lexical vowel swaps (tomato/pasta). accent-variant.
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
        });
    }
});

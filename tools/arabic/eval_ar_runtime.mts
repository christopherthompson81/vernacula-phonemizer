/** RUNTIME-LEVEL A/B for the Arabic diacritizer, scored against PAUSALIZED gold.
 *
 * Both sides go through the identical sync g2p, so a mismatch is a diacritization error and not a g2p
 * difference — the tools/hebrew/eval_modern_holdout.ts trick.
 *
 * ⚠ THE ABSOLUTE NUMBER IS AN A/B INSTRUMENT, NOT A QUALITY SCORE — especially for arz. Egyptian reads
 * ~65% here against MSA's ~86% despite a BETTER character-level DER (1.69% vs 1.83%), because the arz gold is
 * CALIMA-silver rather than human and differs from this engine on common-word conventions (وَ → *wˈa* in the
 * gold, *w* from the model; *fˈiː* vs *fˈi*). Those are convention gaps, not diacritization errors. Both arms
 * of a comparison traverse the identical path, so the offset cancels and the DELTA is meaningful; the level
 * is not. Do not publish "Egyptian is 65% accurate" from this.
 *
 * ⚠ THE GOLD MUST BE PAUSALIZED THE SAME WAY THE RUNTIME PAUSALIZES THE MODEL. src/languages/arabic/
 * diacritizer.ts applies `pausalize()` to the model's output before the g2p; the sync path does NOT do this
 * for raw input (measured: كِتَابٌ → kitˈaːbun keeps the tanwin, الْمَدْرَسَةُ → almadrˈasa drops the damma).
 * So comparing model output against un-pausalized gold penalises every word-final — which is exactly the 0%
 * the first attempt at this harness produced. `pausalize` below is a FAITHFUL PORT of that function; if it
 * drifts, this measurement silently stops meaning anything.
 */
import { readFileSync } from "node:fs";
import { phonemize, phonemizeAsync } from "../../src/index.ts";
import { pausalize } from "../../src/languages/arabic/diacritizer.ts";

const NIQ = /[ً-ْٰ]/gu;
// ⚠ SEPARATE NON-GLOBAL COPY FOR `.test()`. A /g regex carries `lastIndex` ACROSS calls, so `NIQ.test(w)`
// alternates true/false on identical input and silently mis-masks half the corpus — it reported 1,090
// "undiacritized" words in the MSA gold, which Python measures at 0.0%. Use NIQ for .replace, HAS_NIQ for .test.
const HAS_NIQ = /[ً-ْٰ]/u;
// ⚠ LANG and TEST are parameters: `arz` (Egyptian) shares this pipeline and its own diacritizer, and its
// gold needs the identical pausalize() treatment. AR_LANG=arz AR_TEST=/mnt/data/arz-diac/test.txt
const LANG = process.env.AR_LANG ?? "ar";
const lines = readFileSync(process.env.AR_TEST ?? "/mnt/data/ar-diac/test.txt", "utf8").split("\n")
    .map((l) => l.trim()).filter((l) => l.length > 20 && HAS_NIQ.test(l)).slice(0, Number(process.argv[2] ?? 400));
let words = 0, wexact = 0, sent = 0, sexact = 0, skipped = 0;
for (const gold of lines) {
    const goldIpa = phonemize(pausalize(gold), LANG);      // gold pointing, pausalized, through the sync g2p
    const predIpa = await phonemizeAsync(gold.replace(NIQ, ""), LANG);  // bare → model → runtime pausalize → g2p
    sent++; if (goldIpa === predIpa) sexact++;
    // ⚠ SKIP WORDS THE GOLD NEVER DIACRITIZED. arz gold is CALIMA-silver and 16.4% of its words carry no
    // diacritics at all (MSA: 0.0%). On those the sync path reads bare letters literally — بارسلونا becomes
    // *baːrslwnaː* — while the model correctly restores them (*baːrislunaː*), so scoring them PENALISES THE
    // MODEL FOR BEING RIGHT. Measured: including them reads 61.34% for a pipeline that is visibly healthy.
    // The mask is on the SOURCE word, so it is the same for both arms.
    const srcWords = gold.split(/\s+/).filter(Boolean);
    const g = goldIpa.split(/\s+/), p = predIpa.split(/\s+/);
    if (g.length === p.length && g.length === srcWords.length) {
        for (let i = 0; i < g.length; i++) {
            if (!HAS_NIQ.test(srcWords[i]!)) { skipped++; continue; }   // gold has no pointing here → unscorable
            words++; if (g[i] === p[i]) wexact++;
        }
    } else words += g.length;
}
console.log(`${sent} sentences | sentence-exact ${(sexact/sent*100).toFixed(1)}% | word-exact ${wexact}/${words} = ${(wexact/words*100).toFixed(2)}%  (${skipped} unscorable: gold undiacritized)`);

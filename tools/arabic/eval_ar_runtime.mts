/** RUNTIME-LEVEL A/B for the Arabic diacritizer, scored against PAUSALIZED gold.
 *
 * Both sides go through the identical sync g2p, so a mismatch is a diacritization error and not a g2p
 * difference — the tools/hebrew/eval_modern_holdout.ts trick.
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
const lines = readFileSync(process.env.AR_TEST ?? "/mnt/data/ar-diac/test.txt", "utf8").split("\n")
    .map((l) => l.trim()).filter((l) => l.length > 20 && NIQ.test(l)).slice(0, Number(process.argv[2] ?? 400));
let words = 0, wexact = 0, sent = 0, sexact = 0;
for (const gold of lines) {
    const goldIpa = phonemize(pausalize(gold), "ar");      // gold pointing, pausalized, through the sync g2p
    const predIpa = await phonemizeAsync(gold.replace(NIQ, ""), "ar");  // bare → model → runtime pausalize → g2p
    sent++; if (goldIpa === predIpa) sexact++;
    const g = goldIpa.split(/\s+/), p = predIpa.split(/\s+/);
    if (g.length === p.length) { for (let i = 0; i < g.length; i++) { words++; if (g[i] === p[i]) wexact++; } }
    else words += g.length;
}
console.log(`${sent} sentences | sentence-exact ${(sexact/sent*100).toFixed(1)}% | word-exact ${wexact}/${words} = ${(wexact/words*100).toFixed(2)}%`);

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
import { phonemize, phonemizeAsync } from "/home/chris/Programming/vernacula-phonemizer/src/index.ts";

const NIQ = /[ً-ْٰ]/gu;
const isWs = (c?: string) => c !== undefined && /\s/u.test(c);
const isArabicLetter = (cp: number) => (cp >= 0x0621 && cp <= 0x063a) || (cp >= 0x0641 && cp <= 0x064a)
    || (cp >= 0x0671 && cp <= 0x06d3) || cp === 0x0640;
function isPausalBoundary(next: string | undefined): boolean {
    if (next === undefined || isWs(next)) return true;
    const cp = next.codePointAt(0)!;
    const isMark = (cp >= 0x064b && cp <= 0x065f) || cp === 0x0670;
    return !isArabicLetter(cp) && !isMark;
}
function pausalize(text: string): string {          // faithful port of diacritizer.ts::pausalize
    const chars = [...text]; const out: string[] = [];
    for (let i = 0; i < chars.length; i++) {
        const cp = chars[i]!.codePointAt(0)!;
        if (cp === 0x064b) {
            const n = chars[i + 1]?.codePointAt(0);
            if ((n === 0x0627 || n === 0x0649) && isPausalBoundary(chars[i + 2])) { out.push("َ"); continue; }
        }
        if (cp >= 0x064b && cp <= 0x0650 && isPausalBoundary(chars[i + 1])) continue;
        out.push(chars[i]!);
    }
    return out.join("");
}

const lines = readFileSync("/mnt/data/ar-diac/test.txt", "utf8").split("\n")
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

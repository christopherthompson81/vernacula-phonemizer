/**
 * Pashto STRESS eval — does the engine put the accent on the right vowel?
 *
 * ⚠ THIS MEASURES SOMETHING NO OTHER GATE IN THE REPO CAN SEE, and it paid for itself immediately. Stress is
 * assigned by a heuristic that the referee-eval BACKBONE fold STRIPS before comparing, so it had shipped
 * unmeasured since the engine was written. First run: the rule then in place ("last LONG vowel, else last
 * nucleus") scored 73.8% against 71.8% for "always the last nucleus" — two points of value for all that
 * machinery. Replacing it with "the last nucleus unless it is ə, then the penult" scored 82.8%.
 *
 * ⚠ AND IT DELIBERATELY MEASURES POSITION, NOT STRING EQUALITY. ps scores ~47% segmentally, so comparing
 * whole stressed strings would report the segmental error again with extra steps. The question here is only:
 * given a word, does the accent land on the same NUCLEUS index as the reference? Words whose nucleus counts
 * disagree are not comparable and are reported separately rather than scored as wrong — a count mismatch is a
 * segmental failure, and blaming the stress rule for it would be the same conflation.
 *
 * ⚠ THE BASELINES ARE THE POINT. A stress rule that cannot beat "always the last nucleus" is not a rule, it
 * is a decoration. Three trivial predictors are scored on the identical comparable set.
 *
 *   npx tsx tools/pashto/eval_ps_stress.ts [--examples N]
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { phonemizeWord, phonemizeWordCore } from "../../src/languages/pashto/pashto.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const N_EX = Number(process.argv.find((a) => a.startsWith("--examples="))?.slice(11) ?? 12);

const VOWEL = "aeiouɑəɛɔɪʊ";
/**
 * Split an IPA string into NUCLEI, returning the index of the stressed one.
 *
 * ⚠ A VOWEL + OFFGLIDE IS ONE NUCLEUS, and getting this wrong would silently halve the comparable set. Our
 * g2p writes the -ay diphthong as two characters (`əi`, `aɪ`), while the romanization writes it as a vowel
 * plus a consonantal `y` → our map's `j`. Counted naively those are 2 nuclei against 1, so every masculine
 * singular noun — the single commonest shape in the language — would drop out as "not comparable".
 */
function nuclei(ipa: string): { count: number; stress: number } {
    const s = [...ipa.normalize("NFC")];
    let count = 0, stress = -1, pending = false;
    for (let i = 0; i < s.length; i++) {
        const c = s[i]!;
        if (c === "ˈ" || c === "ˌ") { pending = true; continue; }
        if (!VOWEL.includes(c)) continue;
        // an offglide immediately after a vowel belongs to the nucleus already counted
        const prev = s[i - 1];
        if (prev !== undefined && VOWEL.includes(prev) && (c === "ɪ" || c === "ʊ" || c === "i" || c === "u"))
            continue;
        if (pending) { stress = count; pending = false; }
        count++;
    }
    return { count, stress };
}

const rows = readFileSync(join(HERE, "ps.stress-pswikt.tsv"), "utf8")
    .split("\n").filter((l) => l.trim() && !l.startsWith("#")).map((l) => l.split("\t"));

type Pred = (n: number) => number;
const BASELINES: [string, Pred][] = [
    ["always the LAST nucleus", (n) => n - 1],
    ["always the PENULTIMATE", (n) => Math.max(0, n - 2)],
    ["always the FIRST", () => 0],
];

let comparable = 0, ours = 0, mismatch = 0;
const base = BASELINES.map(() => 0);
const misses: string[] = [];
for (const [w, refIpa] of rows) {
    const r = nuclei(refIpa!);
    const o = nuclei(phonemizeWord(w!));
    if (r.stress < 0 || o.stress < 0 || r.count === 0) continue;
    if (r.count !== o.count) { mismatch++; continue; }
    comparable++;
    if (r.stress === o.stress) ours++;
    else if (misses.length < N_EX)
        misses.push(`  ${w}\t ours ${phonemizeWord(w!)} (nucleus ${o.stress + 1}/${o.count})  ref ${refIpa} (${r.stress + 1})`);
    BASELINES.forEach(([, f], i) => { if (f(r.count) === r.stress) base[i]!++; });
}

const pct = (a: number): string => `${a}/${comparable} = ${((100 * a) / comparable).toFixed(1)}%`;
console.log(`ps STRESS eval — referee tools/pashto/ps.stress-pswikt.tsv (${rows.length} rows)\n`);
console.log(`comparable (same nucleus count) : ${comparable}`);
console.log(`not comparable (segmental)      : ${mismatch}\n`);
console.log(`  ENGINE  "last nucleus unless ə, then penult" : ${pct(ours)}`);
BASELINES.forEach(([name], i) => console.log(`  baseline ${name.padEnd(26)} : ${pct(base[i]!)}`));
const best = Math.max(...base);
console.log(
    `\n⚠ ${ours > best ? "The engine BEATS" : ours === best ? "The engine TIES" : "The engine LOSES TO"}` +
        ` the best trivial baseline (${pct(best)}).`,
);
if (misses.length) console.log(`\nmisses (first ${misses.length}):\n${misses.join("\n")}`);
void phonemizeWordCore;

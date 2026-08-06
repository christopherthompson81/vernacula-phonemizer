/**
 * END-TO-END evaluation of the Khmer boundary tagger — does restoring the boundary restore the READING?
 *
 * ⚠ WHY THIS EXISTS SEPARATELY FROM THE TRAINING SCORE. `train_km_segmenter.py` reports boundary P/R/F1, which is
 * the model's accuracy at its own task. It is not the thing we care about. What matters is whether the phonemes
 * come out right, and the two can diverge: an over-split (precision 74.6%) may be harmless if the extra boundary
 * falls where the syllabifier would have broken anyway, or it may corrupt a word that was reading correctly.
 * Only measuring the IPA answers that.
 *
 * THE TEST SET IS HUMAN-LABELLED. Every case is a junction where a Khmer writer actually typed U+200B, so the
 * boundary is known. The reference reading is the two words phonemized SEPARATELY.
 *
 * ⚠ AND THE REFERENCE IS A REFERENCE, NOT GOLD. `phonemize(a) + phonemize(b)` is what the engine produces when it
 * can see the boundary; it is not an authority on Khmer phonology, and a genuine compound may legitimately be
 * pronounced differently from its parts. So this measures AGREEMENT WITH THE BOUNDARY-AWARE READING, which is the
 * quantity the model is supposed to move — not "correctness" in the abstract.
 *
 *   npx tsx tools/khmer/eval_km_segmenter.mts <km-paragraphs.txt> [pairs] [bilstm|perceptron]
 *
 * ⚠ THIS METRIC IS THE FAIR ONE FOR COMPARING THE TWO MODELS, and the held-out F1 is not. The training labels
 * leave any rare token of <= 13 characters at "no boundary" by default (build_km_segmenter_data.py layer 3), and
 * 98.8% of the BiLSTM's scored precision errors land on exactly those unverified zeros — so F1 penalises both
 * models for splitting compounds nobody ever labelled. This eval scores IPA against the boundary-aware reading,
 * which no label pipeline touched.
 */
import { readFileSync } from "node:fs";

import { phonemize } from "../../src/index.ts";
import { createKhmerSegmenter } from "../../src/languages/khmer/khmerSegmenter.ts";
import { restoreBoundaries, havePerceptron } from "../../src/languages/khmer/khmerPerceptron.ts";

const src = process.argv[2];
const WANT = Number(process.argv[3] ?? 4000);
if (src === undefined) {
    console.error("usage: eval_km_segmenter.mts <km-paragraphs.txt> [pairs]");
    process.exit(2);
}

const KH = /^[ក-៓ៜ-៝]+$/u;
const P = (s: string): string => String(phonemize(s, "km")).replace(/\s+/gu, "");

// Deterministic stride over the corpus so the set is reproducible; one pair per line at most, to avoid
// over-weighting whichever lines happen to be densely annotated.
const lines = readFileSync(src, "utf8").split("\n");
const step = Math.max(1, Math.floor(lines.length / (WANT * 10)));
const pairs: [string, string][] = [];
for (let i = 0; i < lines.length && pairs.length < WANT; i += step) {
    const toks = lines[i]!.split(/[​‌]/u);
    for (let k = 0; k + 1 < toks.length; k++) {
        const a = toks[k]!, b = toks[k + 1]!;
        if (KH.test(a) && KH.test(b) && a.length >= 2 && b.length >= 2) { pairs.push([a, b]); break; }
    }
}

const which = process.argv[4] ?? "bilstm";
let restore: (t: string) => Promise<string>;
if (which === "perceptron") {
    if (!havePerceptron()) { console.error("no km-perceptron.tsv"); process.exit(3); }
    restore = (t) => Promise.resolve(restoreBoundaries(t));
} else {
    const segmenter = await createKhmerSegmenter();
    if (!segmenter) { console.error("no model / onnxruntime-node — nothing to evaluate"); process.exit(3); }
    restore = (t) => segmenter.restore(t);
}
console.log(`  model: ${which}`);

let syncOk = 0, neuralOk = 0, fixed = 0, broke = 0, n = 0, recovered = 0;
const brokeEg: string[] = [];
const fixedEg: string[] = [];
for (const [a, b] of pairs) {
    const joined = a + b;
    let ref: string, sync: string, neural: string, seg: string;
    try {
        ref = P(a) + P(b);
        sync = P(joined);
        seg = await restore(joined);
        neural = P(seg);
    } catch { continue; }
    n++;
    // did the model put a boundary at the human's position at all?
    if (seg.indexOf("​") === a.length) recovered++;
    const s = sync === ref, u = neural === ref;
    if (s) syncOk++;
    if (u) neuralOk++;
    if (!s && u) { fixed++; if (fixedEg.length < 4) fixedEg.push(`${a}|${b}  ${sync} → ${neural}`); }
    if (s && !u) { broke++; if (brokeEg.length < 4) brokeEg.push(`${a}|${b}  ${sync} → ${neural}`); }
}

const pc = (x: number): string => `${(100 * x / n).toFixed(1)}%`;
console.log(`  ${n} human-marked junctions (writer-typed U+200B)\n`);
console.log(`  reading matches the boundary-aware reference:`);
console.log(`    sync (no segmentation)   ${syncOk.toString().padStart(5)}  ${pc(syncOk)}`);
console.log(`    neural segmentation      ${neuralOk.toString().padStart(5)}  ${pc(neuralOk)}`);
console.log(`\n    FIXED  (was wrong, now right) ${fixed}  ${pc(fixed)}`);
console.log(`    BROKE  (was right, now wrong) ${broke}  ${pc(broke)}`);
console.log(`    net ${fixed - broke >= 0 ? "+" : ""}${fixed - broke} utterances (${pc(fixed - broke)})`);
console.log(`\n  boundary placed at the human's exact position: ${recovered}  ${pc(recovered)}`);
if (fixedEg.length) { console.log("\n  fixed:"); for (const e of fixedEg) console.log(`    ${e}`); }
if (brokeEg.length) { console.log("\n  broke:"); for (const e of brokeEg) console.log(`    ${e}`); }

/**
 * REFEREE comparison for Khmer word-boundary restoration — the independent-gold version of the eval.
 *
 * ⚠ WHY THIS EXISTS ALONGSIDE eval_km_segmenter.mts. That eval scores the joined reading against
 * `phonemize(a) + phonemize(b)` — this engine's own output with the boundary visible. It measures the right
 * QUANTITY but its reference is not independent: if the engine reads a word wrongly, both sides are wrong
 * together and the error cancels. Every number it produced carried that caveat.
 *
 * Here the gold comes from OUTSIDE: `tools/referee-eval/referees/km.wikipron-khm-broad.tsv`, 7,107 human
 * transcriptions from wikipron. The test constructs the situation Khmer actually presents — two words written with
 * no space between them — and asks whether the engine recovers the two HUMAN readings:
 *
 *     w1 + w2  (concatenated, no boundary)  →  phonemize  →  compare against fold(ipa1) + fold(ipa2)
 *
 * Scored on the segmental backbone with the language's justified folds (`makeFold` from the referee harness, the
 * same folds the fleet's referee gate uses), so transcription-convention differences do not count as errors.
 *
 * ⚠ WHAT A FAILURE HERE DOES AND DOES NOT MEAN. A pair can disagree because the boundary was missed, or because
 * the engine reads one of the two words differently from wikipron regardless of segmentation. The BASELINE column
 * separates those: each word is also scored in ISOLATION, so `isolated` is the ceiling this test can reach and the
 * segmentation columns are meaningful only against it.
 *
 *   npx tsx tools/khmer/referee_km_segmenter.mts [pairs]
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { phonemize } from "../../src/index.ts";
import { createKhmer } from "../../src/languages/khmer/khmer.ts";
import { createKhmerSegmenter } from "../../src/languages/khmer/khmerSegmenter.ts";
import { makeFold } from "../referee-eval/eval.ts";
import { CONFIG } from "../referee-eval/config.ts";

const WANT = Number(process.argv[2] ?? 3000);
const HERE = dirname(fileURLToPath(import.meta.url));

const cfg = CONFIG["km"];
if (!cfg) throw new Error("no km referee config");
const fold = makeFold(cfg);

// referee: word <TAB> space-segmented IPA
const rows: [string, string][] = [];
for (const line of readFileSync(join(HERE, "../referee-eval/referees/km.wikipron-khm-broad.tsv"), "utf8").split("\n")) {
    if (line.startsWith("#") || !line.includes("\t")) continue;
    const [w, ipa] = line.split("\t");
    if (w && ipa && /^[ក-៓ៜ-៝]{2,}$/u.test(w)) rows.push([w, ipa.replace(/\s+/gu, "")]);
}

// Deterministic adjacent pairing over the sorted referee, so the set is reproducible and no RNG is involved.
const pairs: [string, string, string, string][] = [];
for (let i = 0; i + 1 < rows.length && pairs.length < WANT; i += 2) {
    const [w1, i1] = rows[i]!, [w2, i2] = rows[i + 1]!;
    if (w1 === w2) continue;
    pairs.push([w1, w2, i1, i2]);
}

const unsegmented = createKhmer({ segment: false });
const perceptron = createKhmer();                       // sync default: perceptron boundaries
const bilstm = await createKhmerSegmenter();
const strip = (s: string): string => fold(s).replace(/\s+/gu, "");

let n = 0, isolated = 0, joinedOk = 0, percOk = 0, lstmOk = 0;
for (const [w1, w2, i1, i2] of pairs) {
    const gold = strip(i1) + strip(i2);
    let iso: string, joined: string, perc: string, lstm: string;
    try {
        iso = strip(unsegmented.text(w1)) + strip(unsegmented.text(w2));
        joined = strip(unsegmented.text(w1 + w2));
        perc = strip(perceptron.text(w1 + w2));
        lstm = bilstm ? strip(unsegmented.text(await bilstm.restore(w1 + w2))) : "";
    } catch { continue; }
    n++;
    if (iso === gold) isolated++;
    if (joined === gold) joinedOk++;
    if (perc === gold) percOk++;
    if (lstm === gold) lstmOk++;
}

const pc = (x: number): string => `${(100 * x / n).toFixed(1)}%`;
console.log(`  ${n} pairs built from ${rows.length} wikipron referee words (HUMAN gold, folded backbone)\n`);
console.log(`  agreement with the referee's two readings:`);
console.log(`    each word read in ISOLATION (the ceiling)   ${isolated.toString().padStart(5)}  ${pc(isolated)}`);
console.log(`    concatenated, NO segmentation               ${joinedOk.toString().padStart(5)}  ${pc(joinedOk)}`);
console.log(`    concatenated + perceptron (sync path)       ${percOk.toString().padStart(5)}  ${pc(percOk)}`);
if (bilstm) console.log(`    concatenated + BiLSTM (async path)         ${lstmOk.toString().padStart(5)}  ${pc(lstmOk)}`);
const recover = (x: number): string =>
    isolated > joinedOk ? `${(100 * (x - joinedOk) / (isolated - joinedOk)).toFixed(1)}%` : "n/a";
console.log(`\n  share of the recoverable gap closed (ceiling − unsegmented):`);
console.log(`    perceptron ${recover(percOk)}`);
if (bilstm) console.log(`    BiLSTM     ${recover(lstmOk)}`);

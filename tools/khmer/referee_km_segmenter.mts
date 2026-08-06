/**
 * REFEREE comparison for Khmer word-boundary restoration — the independent-gold version of the eval.
 *
 * ⚠ WHY THIS EXISTS ALONGSIDE eval_km_segmenter.mts. That eval scores the joined reading against
 * `phonemize(a) + phonemize(b)` — this engine's own output with the boundary visible. It measures the right
 * QUANTITY but its reference is not independent: if the engine reads a word wrongly, both sides are wrong
 * together and the error cancels. Every number it produced carried that caveat.
 *
 * Here the gold comes from OUTSIDE: `tools/referee-eval/referees/km.wikipron-khm-broad.tsv`, 7,107 human
 * transcriptions from wikipron. The test asks whether the engine recovers the two HUMAN readings from a run
 * written with no boundary in it:
 *
 *     w1 + w2  (as one run)  →  phonemize  →  compare against fold(ipa1) + fold(ipa2)
 *
 * ⚠ THE PAIRS COME FROM REAL TEXT, NOT FROM PERMUTING THE DICTIONARY. Earlier versions of this file built pairs by
 * combining referee entries — first alphabetically adjacent ones (which in Khmer share long prefixes: mean 3.11
 * characters, and 729 pairs where one word was literally a prefix of the other, `កង`+`កងពលតូច` → `កងកងពលតូច`), then
 * randomly. Both are UNNATURAL INPUT: strings no Khmer writer would produce, fed to models trained on running
 * prose, so the score described behaviour out of distribution rather than behaviour on Khmer.
 *
 * Pairs are now harvested from the corpus itself — two words a writer separated with U+200B — and kept only when
 * BOTH have a referee transcription. That buys natural input AND independent gold at the same time, which is what
 * the two earlier evals each had only one of.
 *
 * Scored on the segmental backbone with the language's justified folds (`makeFold` from the referee harness, the
 * same folds the fleet's referee gate uses), so transcription-convention differences do not count as errors.
 *
 * ⚠ WHAT A FAILURE HERE DOES AND DOES NOT MEAN. A pair can disagree because the boundary was missed, or because
 * the engine reads one of the two words differently from wikipron regardless of segmentation. The BASELINE column
 * separates those: each word is also scored in ISOLATION, so `isolated` is the ceiling this test can reach and the
 * segmentation columns are meaningful only against it.
 *
 *   npx tsx tools/khmer/referee_km_segmenter.mts [pairs] [clean]
 *
 * ⚠ PASS `clean` TO EXCLUDE THE DICTIONARY'S OWN VOCABULARY, AND READ THAT NUMBER FIRST. The training labels are
 * built partly from google/language-resources' Khmer lexicon (build_km_segmenter_data.py layer 4), and 6,119 of
 * this referee's 7,062 words — 86.6% — are in it. Both are word-level Khmer dictionaries, so they overlap almost
 * completely. Scoring on the full set therefore tests the model largely on strings it was TAUGHT are words, which
 * inflates the result: the full-set score rose 47.8% → 55.0% when layer 4 was added, far out of proportion to the
 * same change's effect on held-out F1 (+2.3) or corpus junctions (+3.1pp). `clean` restricts to the 943 words the
 * lexicon does not contain.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createKhmer } from "../../src/languages/khmer/khmer.ts";
import { createKhmerSegmenter } from "../../src/languages/khmer/khmerSegmenter.ts";
import { makeFold } from "../referee-eval/eval.ts";
import { CONFIG } from "../referee-eval/config.ts";

const WANT = Number(process.argv[2] ?? 3000);
const CLEAN = process.argv[3] === "clean";
const DUMP = process.argv[4] ?? process.env["KM_DUMP"];
const HERE = dirname(fileURLToPath(import.meta.url));

const cfg = CONFIG["km"];
if (!cfg) throw new Error("no km referee config");
const fold = makeFold(cfg);

// The label-side lexicon, so its vocabulary can be excluded from the test set.
const lexWords = new Set<string>();
try {
    for (const line of readFileSync(join(HERE, "km-lexicon-words.txt"), "utf8").split("\n")) {
        if (!line.startsWith("#") && line.trim()) lexWords.add(line.trim());
    }
} catch { /* no lexicon → nothing to exclude */ }

// referee: word <TAB> space-segmented IPA
const rows: [string, string][] = [];
for (const line of readFileSync(join(HERE, "../referee-eval/referees/km.wikipron-khm-broad.tsv"), "utf8").split("\n")) {
    if (line.startsWith("#") || !line.includes("\t")) continue;
    const [w, ipa] = line.split("\t");
    if (!w || !ipa || !/^[ក-៓ៜ-៝]{2,}$/u.test(w)) continue;
    if (CLEAN && lexWords.has(w)) continue;   // seen by the label pipeline → excluded
    rows.push([w, ipa.replace(/\s+/gu, "")]);
}

const KH = /^[ក-៓ៜ-៝]{2,}$/u;

// referee word → its transcription, for the gold side
const refIpa = new Map(rows);

/**
 * Harvest pairs from REAL TEXT: adjacent tokens a Khmer writer separated with U+200B, both of which the referee
 * transcribes. Deterministic stride so the set is reproducible, and one pair per line at most so a densely
 * annotated paragraph cannot dominate.
 */
const pairs: [string, string, string, string][] = [];
if (DUMP === undefined) {
    console.error("usage: referee_km_segmenter.mts [pairs] [clean] <km-paragraphs.txt>   (or set KM_DUMP)");
    console.error("  pairs are harvested from real writer-marked junctions — see the header on unnatural input");
    process.exit(2);
}
const lines = readFileSync(DUMP, "utf8").split("\n");
const step = Math.max(1, Math.floor(lines.length / (WANT * 12)));
for (let i = 0; i < lines.length && pairs.length < WANT; i += step) {
    const toks = lines[i]!.split(/[\u200b\u200c]/u);
    for (let k = 0; k + 1 < toks.length; k++) {
        const a = toks[k]!, b = toks[k + 1]!;
        if (!KH.test(a) || !KH.test(b)) continue;
        const ia = refIpa.get(a), ib = refIpa.get(b);
        if (ia === undefined || ib === undefined) continue;
        if (a === b || a.startsWith(b) || b.startsWith(a)) continue;
        pairs.push([a, b, ia, ib]);
        break;
    }
}

const unsegmented = createKhmer({ segment: false });
const perceptron = createKhmer();                       // sync default: perceptron boundaries
const bilstm = await createKhmerSegmenter();
/**
 * ⚠ FOLD PER WORD, NOT PER STRING — and getting this wrong cost ~16 points and nearly became a published number.
 * The km referee folds are WORD-ANCHORED: `[ptkc]$ → ʔ` glottalises a word-FINAL stop. The reference is built from
 * two referee entries folded separately, so each one's final stop is glottalised; folding the engine's whole
 * output as a single string only glottalises the LAST word's. So `cɑt` + `riən` gives `caʔriən` on the reference
 * side and `catriən` on the prediction side — a guaranteed mismatch for every pair whose first word ends in a
 * stop, which in Khmer is a great many of them.
 *
 * The symptom was that the boundary was placed correctly (exactly one, right position) 72.2% of the time while
 * the READING matched only 55.8% — 16 points lost on pairs the model had segmented perfectly. Splitting on the
 * engine's own word spaces before folding makes the two sides comparable.
 */
const strip = (s: string): string => s.trim().split(/\s+/u).filter(Boolean).map(fold).join("");

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
console.log(`  ${n} REAL writer-marked junctions whose both words the referee transcribes (HUMAN gold, folded)`
    + (CLEAN ? `  [CLEAN: ${lexWords.size} lexicon forms excluded from the test set]` : `  [FULL SET — 86.6% of these words are in the label lexicon; see the header]`) + "\n");
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

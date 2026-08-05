/**
 * Build the Khmer word-frequency table — src/languages/khmer/km-wordfreq.tsv.
 *
 * WHY KHMER NEEDS A WORD LIST AT ALL. Khmer writes no space between words, so `khmer.ts`'s tokenizer takes a
 * MAXIMAL run of Khmer letters as one unit (`TOKEN = /([ក-៓ៜ-៝]+)|…/`). That is adequate for syllable-driven
 * g2p, and it is not adequate for anything that needs to know where a word ENDS — most immediately the
 * iteration mark ៗ, which means "repeat the preceding WORD" and occurs 24,413 times in the mined corpus.
 *
 * ⚠ THE SUPERVISION IS ALREADY IN THE TEXT. Khmer writers insert U+200B ZERO WIDTH SPACE at word boundaries,
 * inconsistently but in quantity: the mined corpus yields 2,851,516 ZWSP/space-delimited Khmer tokens. Those are
 * human-typed boundary annotations, free for the taking, and they are what this table counts. Nothing here is
 * inferred from a model trained elsewhere — the frequencies come from where Cambodians put the breaks.
 *
 * WHY FREQUENCIES AND NOT A BARE WORD LIST. 790,900 distinct tokens come out of that harvest, and many are
 * multi-word runs the writer simply did not split. A longest-match segmenter over such a list prefers the
 * COMPOUND every time and defeats its own purpose. Frequency-weighted (unigram Viterbi) segmentation does not:
 * a run appearing 3 times loses to two words appearing 20,000 times each.
 *
 * ⚠ THE THRESHOLD IS CHOSEN BY MEASUREMENT, AND THE TWO METRICS DISAGREE. Evaluated on held-out lines, with the
 * gold standard being human-typed ZWSP boundaries the model never saw (80/20 split, 11,194 held-out multi-token
 * runs):
 *
 *     freq>=   types     KB   full-run F1   last-word exact
 *          3  49,270   2001         69.2%             —
 *          5  27,581   1021         70.5%           50.7%
 *         10  13,518    415         70.9%  ← F1 peak 53.4%
 *         25   5,912    154         68.7%           55.2%  ← last-word peak, and 2.7x smaller
 *         50   3,260     77         64.9%             —
 *
 * Full-run F1 peaks at 10 and LAST-WORD accuracy peaks at 25, because a larger vocabulary admits more long
 * spurious "words" that swallow the tail. The ៗ rule needs only the final boundary, so 25 is chosen: the better
 * number on the metric that is actually consumed, at a fifth of the disk.
 *
 * ⚠ AND ~55% IS THE HONEST FIGURE, not a placeholder. It is a large improvement on the alternative and it is not
 * accuracy in the usual sense, for two reasons worth stating. First, the gold standard is itself inconsistent —
 * writers disagree about where a compound divides, so some "errors" are a defensible second opinion. Second, the
 * test set is deliberately the HARD half: only runs a human split into 2+ tokens. Measured over all 24,413 ៗ
 * antecedents, 24.3% are already a single vocabulary word and need no segmentation at all, so the end-to-end
 * expectation is roughly 24% + 0.55 x 76% ≈ 66% correct against 24% for repeating the whole run.
 *
 * Run: npx tsx tools/gen/build-km-wordfreq.mts <km-paragraphs.txt>
 *   where the input is the output of tools/normalization/wikidump-to-text.py on a kmwiki dump (#585).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Khmer letters, marks and signs — deliberately EXCLUDING ៗ (U+17D7), which is what we segment around. */
const KHMER_RUN = /[ក-៓ៜ៝]+/gu;
/** The boundary characters a Khmer writer types: ZWSP, ZWNJ, and ordinary whitespace. */
const BREAKS = /[​‌\s]+/gu;

/** Below this count a token is more likely an unsplit run or a typo than a word — see the header's table. */
const MIN_COUNT = 25;

const src = process.argv[2];
if (src === undefined) {
    console.error("usage: npx tsx tools/gen/build-km-wordfreq.mts <km-paragraphs.txt>");
    process.exit(2);
}

const text = readFileSync(src, "utf8").replace(BREAKS, " ");
const counts = new Map<string, number>();
let total = 0;
for (const m of text.matchAll(KHMER_RUN)) {
    const w = m[0];
    counts.set(w, (counts.get(w) ?? 0) + 1);
    total++;
}

const kept = [...counts].filter(([, n]) => n >= MIN_COUNT).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
const covered = kept.reduce((a, [, n]) => a + n, 0);

const out = join(dirname(fileURLToPath(import.meta.url)), "../../src/languages/khmer/km-wordfreq.tsv");
// Sorted by descending count then by word, so the file is stable across runs and its head is readable.
writeFileSync(out, kept.map(([w, n]) => `${w}\t${n}`).join("\n") + "\n", "utf8");

console.log(`${total.toLocaleString()} tokens · ${counts.size.toLocaleString()} distinct`);
console.log(`kept ${kept.length.toLocaleString()} with count >= ${MIN_COUNT}, covering ${(100 * covered / total).toFixed(1)}% of tokens`);
console.log(`→ ${out}`);

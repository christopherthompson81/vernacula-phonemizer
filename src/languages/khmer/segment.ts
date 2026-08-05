/**
 * Khmer word segmentation — a maximal Khmer run → its words.
 *
 * WHY THIS EXISTS. Khmer writes no space between words, so the engine's tokenizer takes a maximal run of Khmer
 * letters as one unit. That is fine for syllable-driven g2p and useless for anything needing to know where a
 * word ENDS — most immediately the iteration mark ៗ, which means "repeat the preceding WORD" and occurs 24,413
 * times in the mined corpus (#585). Repeating the whole run instead is correct only 24.3% of the time, because
 * that is the share of ៗ antecedents which happen to be a single vocabulary word.
 *
 * HOW, AND WHY NOT LONGEST-MATCH. The vocabulary in `km-wordfreq.tsv` is harvested from where Khmer writers
 * typed U+200B ZERO WIDTH SPACE — human boundary annotation, present inconsistently but in quantity. Because it
 * is inconsistent, the harvest also contains multi-word runs nobody split, and a longest-match segmenter over
 * such a list prefers the COMPOUND every time, defeating its own purpose. So this is a unigram Viterbi: it
 * minimises total -log(frequency), and a run appearing 25 times loses to two words appearing 20,000 times each.
 *
 * ⚠ ACCURACY IS 54.7% ON THE LAST BOUNDARY, and that is the honest number rather than a placeholder. Measured
 * against held-out human ZWSP boundaries the model never saw (80/20 split, 11,194 multi-token runs). Two things
 * make it a floor rather than a verdict: the gold standard is itself inconsistent, since writers disagree about
 * where a compound divides, so some "errors" are a defensible second opinion; and the test set is deliberately
 * the hard half — only runs a human chose to split. End to end over all ៗ antecedents the expectation is roughly
 * 24% + 0.547 × 76% ≈ 66% correct, against 24% for repeating the whole run.
 *
 * ⚠ THIS IS NOT WIRED INTO THE g2p PATH, and that is deliberate. `khmer.ts` still phonemizes a maximal run as
 * one unit. Segmenting there would change the pronunciation of ALL Khmer text — the shipped exceptions lexicon
 * would start hitting on words rather than runs — and the measured gain is small: the lexicon hit rate moves
 * 15.0% → 19.2%, which is not worth perturbing every reading in the language without a referee-eval pass to
 * justify it. This module exists for the callers that need a BOUNDARY, not a pronunciation.
 */
import { loadTsvMap } from "../../core/loadTsv.ts";

/** word → occurrence count, harvested from writer-typed ZWSP boundaries. See tools/gen/build-km-wordfreq.mts. */
const FREQ: ReadonlyMap<string, number> = loadTsvMap<number>(
    import.meta.url,
    "km-wordfreq.tsv",
    (v) => {
        const n = Number(v);
        return Number.isFinite(n) && n > 0 ? n : undefined;
    },
    { optional: true },
);

const TOTAL = [...FREQ.values()].reduce((a, b) => a + b, 0);
/** Longest vocabulary entry — the Viterbi window. Bounded so a pathological entry cannot make this quadratic. */
const MAX_WORD = Math.min(24, [...FREQ.keys()].reduce((m, w) => Math.max(m, w.length), 1));

/**
 * Cost of a span, in negative log probability. An out-of-vocabulary span is charged per CHARACTER so that a long
 * unknown stretch is worse than a short one — otherwise Viterbi happily swallows a whole run as one unknown
 * "word", which is precisely the behaviour this module exists to avoid.
 */
const OOV_PER_CHAR = TOTAL === 0 ? 1 : Math.log(TOTAL * 100);
/**
 * ⚠ A PER-SEGMENT PENALTY, WITHOUT WHICH AN UNKNOWN RUN IS SHREDDED INTO CHARACTERS. Charging out-of-vocabulary
 * spans purely per character makes every segmentation of an unknown run cost EXACTLY the same — one span of
 * eight characters and eight spans of one are both `8 × OOV_PER_CHAR` — so the answer falls to the tie-break,
 * which took the shortest span and returned one segment per letter. For the ៗ rule that means reduplicating a
 * single consonant.
 *
 * A flat cost per segment breaks the tie toward FEWER words, which is the right prior for an unknown stretch. It
 * is charged on known words too, so the model is a plain unigram with a word-insertion penalty rather than two
 * different scoring regimes.
 *
 * ⚠ IT IS NOT FREE, and the cost was measured rather than assumed. On the held-out set, last-word accuracy goes
 * 55.2% → 54.7% and full-run F1 68.7% → 68.3% as the penalty rises from 0 to 1, and flattens thereafter (2 and 4
 * give 54.6%). Half a point of accuracy buys the guarantee that an unknown run is never returned as one segment
 * per consonant, which is a worse failure than a misplaced boundary: a misplaced boundary reduplicates the wrong
 * word, while shredding reduplicates a single letter that is not a word in any language.
 */
const SEGMENT_PENALTY = 1;
const cost = (span: string): number => {
    const n = FREQ.get(span);
    return SEGMENT_PENALTY + (n === undefined ? OOV_PER_CHAR * span.length : Math.log(TOTAL / n));
};

/** Bounded memo, because the same runs recur constantly in real text and Viterbi is the hot path here. */
const memo = new Map<string, readonly string[]>();
const MEMO_CAP = 20_000;

/**
 * Split one maximal Khmer run into words. Returns `[run]` unchanged when the vocabulary is unavailable, so a
 * missing data file degrades to today's behaviour rather than throwing.
 */
export function segmentKhmer(run: string): readonly string[] {
    if (run === "" || FREQ.size === 0 || run.length === 1) return [run];
    const hit = memo.get(run);
    if (hit !== undefined) return hit;

    const n = run.length;
    const best = new Float64Array(n + 1).fill(Infinity);
    const back = new Int32Array(n + 1);
    best[0] = 0;
    for (let i = 1; i <= n; i++)
        for (let len = 1; len <= Math.min(MAX_WORD, i); len++) {
            const prev = best[i - len]!;
            if (prev === Infinity) continue;
            const c = prev + cost(run.slice(i - len, i));
            if (c < best[i]!) { best[i] = c; back[i] = len; }
        }

    const out: string[] = [];
    for (let i = n; i > 0;) { const len = back[i]!; out.push(run.slice(i - len, i)); i -= len; }
    out.reverse();
    if (memo.size < MEMO_CAP) memo.set(run, out);
    return out;
}

/**
 * The LAST word of a run — what the iteration mark ៗ needs, and the only boundary whose accuracy has been
 * measured. Separate from `segmentKhmer` so a caller cannot accidentally depend on the interior boundaries,
 * which are weaker: full-run F1 is 68.3% against 54.7% for this one alone.
 */
export function lastKhmerWord(run: string): string {
    const parts = segmentKhmer(run);
    return parts[parts.length - 1] ?? run;
}

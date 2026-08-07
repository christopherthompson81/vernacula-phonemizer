/**
 * Khmer word-boundary tagger — the neural restorer for the boundaries Khmer does not write.
 *
 * WHY IT EXISTS. Khmer has no inter-word space, so `khmer.ts`'s tokeniser takes a MAXIMAL run of Khmer letters as
 * one unit and the syllabifier re-parses across the invisible word boundaries. Measured on 4,000 junctions where a
 * Khmer writer actually typed U+200B, joining the two words CORRUPTS the reading 54.6% of the time: `នៅ|សតវត្ស`
 * reads *nɨwhtɑʋɑt* joined against *nɨw + sɑtɑʋoət* apart — the ស collapses into a coda of the previous syllable
 * and a whole syllable disappears. The boundary is an input the reader needs and does not have.
 *
 * ⚠ WHY NOT THE UNIGRAM SEGMENTER THAT ALREADY SHIPS. `segment.ts` is a unigram Viterbi over ZWSP-harvested word
 * frequencies, and it CANNOT recover these boundaries — measured 0 of 12 on the month compounds. Splitting always
 * costs an extra −log(p) term, so any compound that is itself in the vocabulary wins outright, and `ខែមករា`
 * ("month January") is there 505 times. Frequency data cannot fix a problem caused by frequency. That module
 * stays where it is, serving the ៗ reduplication rule, which needs one boundary rather than all of them.
 *
 * WHAT THIS DOES. One BiLSTM forward pass over the run's characters emits, per character, "a word starts here" or
 * not; boundaries are re-inserted as U+200B, which the tokeniser already treats as a run break. Output length ==
 * input length, so there is no autoregressive decode: the model cannot lose or invent a character, and its worst
 * failure is a boundary in the wrong place.
 *
 * ⚠ THE LABELS IT LEARNED FROM WERE CLEANED, AND THAT IS THE INTERESTING PART. A typed ZWSP is a positive a human
 * placed; its absence is NOT a negative, because writers mark boundaries only sometimes. See
 * tools/khmer/build_km_segmenter_data.py — a line-density filter decides whose zeros can be believed, a per-split-
 * point rate measured on that subset recovers boundaries no writer marked, and positions the corpus cannot settle
 * are MASKED rather than guessed.
 *
 * `onnxruntime-node` is an OPTIONAL dependency, imported lazily; if it — or the .onnx model — is absent,
 * `createKhmerSegmenter()` resolves to `undefined` and callers keep today's unsegmented sync behaviour (no throw).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadOrt, type OrtLike, type OrtSession } from "../../core/onnx.ts";

/** U+200B ZERO WIDTH SPACE — what Khmer writers type at a word boundary, and what the tokeniser breaks a run on. */
export const ZWSP = "​";

/** A maximal Khmer run, matching `khmer.ts`'s TOKEN class: letters, marks and signs, excluding ៗ and the digits. */
const KHMER_RUN = /[ក-៓ៜ-៝]{2,}/gu;

/** Shortest permissible word piece. See the guard's note in the decode loop below. */
const MIN_PIECE = 2;
/** …except an independent vowel, which IS a standalone Khmer word. Same exception as khmerPerceptron.ts,
 *  and see its note: this no longer props up a g2p defect, which was fixed at source. */
const STANDALONE_1CHAR = /[\u17A3-\u17B3]/u;

interface Meta {
    src: Record<string, number>;
    maxRun: number;
}

export interface KhmerSegmenter {
    /** Insert U+200B at every predicted word boundary inside each Khmer run of `text`. */
    restore(text: string): Promise<string>;
}

/**
 * Build the Khmer boundary tagger, or `undefined` when the model / onnxruntime-node is unavailable.
 *
 * Runs longer than the training cap are split at the cap rather than truncated — a long run is rare (p95 is 57
 * characters) but silently dropping its tail would delete text, which is the one thing this path must never do.
 */
export function createKhmerSegmenter(basename = "km-segmenter"): Promise<KhmerSegmenter | undefined> {
    const dir = dirname(fileURLToPath(import.meta.url));
    let meta: Meta;
    try {
        meta = JSON.parse(readFileSync(join(dir, `${basename}.meta.json`), "utf8")) as Meta;
    } catch {
        return Promise.resolve(undefined);
    }
    return loadOrt("Khmer word segmentation")
        .then(async (ort: OrtLike) => {
            const session: OrtSession = await ort.InferenceSession.create(join(dir, `${basename}.int8.onnx`));
            return build(ort, session, meta);
        })
        .catch(() => undefined);
}

function build(ort: OrtLike, session: OrtSession, meta: Meta): KhmerSegmenter {
    const unk = meta.src["<unk>"] ?? 1;
    const cap = meta.maxRun > 0 ? meta.maxRun : 200;

    /** Tag one run (already within the length cap) and return it with U+200B at each predicted boundary. */
    const tagOne = async (run: string): Promise<string> => {
        const chars = [...run];
        const ids = BigInt64Array.from(chars.map((c) => BigInt(meta.src[c] ?? unk)));
        const out = await session.run({ chars: new ort.Tensor("int64", ids, [1, chars.length]) });
        const logits = out["logits"]?.data;
        if (!(logits instanceof Float32Array) || logits.length < chars.length * 3) return run;
        const parts: string[] = [chars[0]!];
        let since = 1; // characters emitted since the last boundary — the guard below needs it
        for (let i = 1; i < chars.length; i++) {
            // class 1 = no boundary, class 2 = a word starts here (class 0 is pad/ignore and never decoded)
            const boundary = logits[i * 3 + 2]! > logits[i * 3 + 1]!
                // ⚠ Same MIN_PIECE decode guard as khmerPerceptron.ts, and for the same measured reason: a
                // one-character fragment changes a word's PHONEMES (បូកដក → ɓouk ɗɑː kɑː), while an ordinary
                // extra boundary only adds a word space. One-char words are 0.46% of gold, so the cost is bounded.
                && (since >= MIN_PIECE || (since === 1 && STANDALONE_1CHAR.test(chars[i - 1]!)))
                && (chars.length - i >= MIN_PIECE || STANDALONE_1CHAR.test(chars[i]!));
            if (boundary) { parts.push(ZWSP); since = 0; }
            parts.push(chars[i]!);
            since++;
        }
        return parts.join("");
    };

    const tagRun = async (run: string): Promise<string> => {
        if (run.length <= cap) return tagOne(run);
        const pieces: string[] = [];
        for (let i = 0; i < run.length; i += cap) pieces.push(await tagOne(run.slice(i, i + cap)));
        return pieces.join(ZWSP); // the cap itself is a boundary guess; a run this long is a compound anyway
    };

    return {
        async restore(text: string): Promise<string> {
            const runs = [...text.matchAll(KHMER_RUN)];
            if (runs.length === 0) return text;
            let out = "";
            let at = 0;
            for (const m of runs) {
                const start = m.index;
                out += text.slice(at, start) + await tagRun(m[0]);
                at = start + m[0].length;
            }
            return out + text.slice(at);
        },
    };
}

/**
 * Danish OOV g2p tagger — a SYNC averaged-perceptron per-grapheme classifier (no torch/onnxruntime; the repo's
 * posTagger precedent). Each grapheme is tagged with a phoneme CHUNK ("" / one / two phonemes) from a ±4-grapheme
 * context window; the chunks concatenate to the word's IPA. Trained on the Danish lexicon (tools/danish/
 * da_tagger_prototype.py → da-g2p.tsv), it recovers the context-conditioned vowel quality / reduction / soft-C that
 * the hand rules miss — held-out OOV 45.5% vs the rule engine's 30.5% on the same split (folded). The MODEL FEATURES here must byte-match the
 * Python `feats()`. Used as the middle tier: lexicon → tagger → rules (danish.ts). See docs/investigations/da_native_bringup_investigation.md.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VOWELS = new Set([..."aeiouyæøå"]);

interface Model {
    labels: string[];
    // feature → [labelIndex, weight] postings (only non-zero, pruned weights). Inference sums postings into a
    // per-label score array, so it touches a handful of entries per feature instead of every label × feature.
    postings: Map<string, Array<[number, number]>>;
}

let MODEL: Model | null | undefined;
function model(): Model | null {
    if (MODEL === undefined) {
        try {
            const path = join(dirname(fileURLToPath(import.meta.url)), "da-g2p.tsv");
            const lines = readFileSync(path, "utf8").split(/\r?\n/); // CRLF-robust (a CRLF checkout would else zero every lookup)
            const labels = lines[0]!.split("\t");
            const labelIdx = new Map(labels.map((l, i) => [l, i] as const));
            const postings = new Map<string, Array<[number, number]>>();
            for (let i = 1; i < lines.length; i++) {
                const l = lines[i]!;
                if (!l) continue;
                const t = l.lastIndexOf("\t"); // "feature\tlabel\tweight" — split last field (weight) off the "feature\tlabel" key
                const k = l.lastIndexOf("\t", t - 1);
                const feat = l.slice(0, k);
                const li = labelIdx.get(l.slice(k + 1, t));
                if (li === undefined) continue; // weight for an unknown label → skip
                const w = Number(l.slice(t + 1));
                (postings.get(feat) ?? postings.set(feat, []).get(feat)!).push([li, w]);
            }
            MODEL = { labels, postings };
        } catch { MODEL = null; } // model absent → tagger disabled (fall through to rules)
    }
    return MODEL;
}

/** Features for the grapheme at index i — MUST byte-match the Python `feats()` in da_tagger_prototype.py. */
function feats(chars: string[], i: number): string[] {
    const g = (k: number): string => (k < 0 ? "^" : k >= chars.length ? "$" : chars[k]!);
    const c = g(i);
    let pre = "";
    for (let k = -1; k <= i; k++) pre += g(k);
    pre = pre.slice(-4);
    return [
        `c=${c}`, `p1=${g(i - 1)}`, `p2=${g(i - 2)}`, `n1=${g(i + 1)}`, `n2=${g(i + 2)}`,
        `pp=${g(i - 1)}${c}`, `nn=${c}${g(i + 1)}`, `tri=${g(i - 1)}${c}${g(i + 1)}`,
        `pre=${pre}`, `pos=${i === 0 ? "i" : i === chars.length - 1 ? "f" : "m"}`,
        `v=${VOWELS.has(c) ? "V" : "C"}`,
    ];
}

/** Tag one Danish word → canonical IPA via the perceptron, or `null` if the model is unavailable. */
export function taggerPhonemize(word: string): string | null {
    const m = model();
    if (!m) return null;
    const chars = [...word.toLowerCase()];
    const scores = new Float64Array(m.labels.length);
    let out = "";
    for (let i = 0; i < chars.length; i++) {
        scores.fill(0);
        for (const ff of feats(chars, i)) {
            const posts = m.postings.get(ff);
            if (posts) for (const [li, w] of posts) scores[li]! += w;
        }
        // argmax with the SAME tie-break as the dense scan: iterate labels in order, strict >, first wins (label 0 =
        // the empty deletion tag, so an all-zero grapheme predicts "" exactly as before).
        let best = 0, bestScore = scores[0]!;
        for (let li = 1; li < scores.length; li++) if (scores[li]! > bestScore) { bestScore = scores[li]!; best = li; }
        out += m.labels[best]!;
    }
    return out;
}

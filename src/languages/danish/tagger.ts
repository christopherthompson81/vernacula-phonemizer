/**
 * Danish OOV g2p tagger — a SYNC averaged-perceptron per-grapheme classifier (no torch/onnxruntime; the repo's
 * posTagger precedent). Each grapheme is tagged with a phoneme CHUNK ("" / one / two phonemes) from a ±4-grapheme
 * context window; the chunks concatenate to the word's IPA. Trained on the Danish lexicon (tools/danish/
 * da_tagger_prototype.py → da-g2p.tsv), it recovers the context-conditioned vowel quality / reduction / soft-C that
 * the hand rules miss — held-out OOV 42.0% vs the rule engine's 25.8% (folded). The MODEL FEATURES here must byte-match the
 * Python `feats()`. Used as the middle tier: lexicon → tagger → rules (danish.ts). See docs/investigations/da_native_bringup_investigation.md.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VOWELS = new Set([..."aeiouyæøå"]);

interface Model {
    labels: string[];
    weights: Map<string, number>; // "feature\tlabel" → weight
}

let MODEL: Model | null | undefined;
function model(): Model | null {
    if (MODEL === undefined) {
        try {
            const path = join(dirname(fileURLToPath(import.meta.url)), "da-g2p.tsv");
            const lines = readFileSync(path, "utf8").split("\n");
            const labels = lines[0]!.split("\t");
            const weights = new Map<string, number>();
            for (let i = 1; i < lines.length; i++) {
                const l = lines[i]!;
                if (!l) continue;
                const t = l.lastIndexOf("\t"); // last field = weight; the rest = "feature\tlabel" key
                weights.set(l.slice(0, t), Number(l.slice(t + 1)));
            }
            MODEL = { labels, weights };
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
    let out = "";
    for (let i = 0; i < chars.length; i++) {
        const f = feats(chars, i);
        let best = m.labels[0]!, bestScore = -Infinity;
        for (const lab of m.labels) {
            let s = 0;
            for (const ff of f) s += m.weights.get(`${ff}\t${lab}`) ?? 0;
            if (s > bestScore) { bestScore = s; best = lab; }
        }
        out += best;
    }
    return out;
}

/**
 * Bengali G2P STRUCTURAL tagger — the neural OOV reader. A per-grapheme BiLSTM (ONNX) that labels each Bengali
 * grapheme with its IPA-chunk TAG (the consonant, COPIED, plus the following inherent vowel ɔ/o or its deletion), run
 * as a SINGLE forward pass. Because output length == input length it CANNOT degenerate and CANNOT break the consonant
 * skeleton — no beam, no autoregressive decode, no degeneration guard. The whole-word ɔ/o realization comes from the
 * bidirectional pass; a per-grapheme CONSONANT-CONSISTENCY MASK constrains each grapheme to only the tags it produced
 * in training (ক → k/kɔ/ko, never ʃ), so the model only ever decides the vowel.
 *
 * The lazy-load + masked decode loop is the shared `createWordStructuralTagger` (core/structuralTagger.ts); this file
 * supplies only the bn-specific bit: an NFC preprocess (no postprocess — Bengali tags carry no stress). This is the
 * OOV GENERALISATION tier: the words the authoritative Kolkata gold + cross-source consensus lexicon
 * (bengali-lexicon.tsv) miss. A lexicon-covered word is served by the sync lexicon path instead (precedence:
 * lexicon → tagger → rule engine). On the seed-0 held-out (OOV) split it reads ɔ/o 90.5% | full 86.4% vs the rule
 * engine's 62.6% ɔ/o.
 *
 * `onnxruntime-node` is an OPTIONAL dependency, imported lazily; if it — or the .onnx model — is absent,
 * createBengaliTagger() resolves to `undefined` and callers fall back to the sync rule engine (no throw).
 */
import { dirname } from "node:path";

import { createWordStructuralTagger, type WordStructuralTagger } from "../../core/structuralTagger.ts";
import { dataDir } from "../../core/dataPath.ts";

export type BengaliTagger = WordStructuralTagger;

/** Build the Bengali OOV tagger, or `undefined` if the model / onnxruntime-node is unavailable. */
export function createBengaliTagger(basename = "bn-g2p-tagger"): Promise<BengaliTagger | undefined> {
    return createWordStructuralTagger({
        dir: dataDir(import.meta.url),
        basename,
        modelFile: `${basename}.int8.onnx`,
        context: "Bengali neural tagging",
        epEnv: "BN_ORT_EP",
        // NFC-normalize so the graphemes match the training vocab (the sync lexicon/rule paths also NFC).
        preprocess: (w) => w.normalize("NFC"),
    });
}

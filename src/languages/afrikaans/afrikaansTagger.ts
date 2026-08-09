/**
 * Afrikaans OOV g2p STRUCTURAL tagger — the neural OOV reader. A per-grapheme BiLSTM (ONNX) that labels each letter
 * with its IPA-chunk TAG in a single forward pass. Output length == input length so it cannot degenerate, and a
 * per-grapheme CONSONANT-CONSISTENCY MASK constrains each letter to the tags it produced in training.
 *
 * ⚠ NO STRESS POSTPROCESS, unlike Norwegian's. af emits no stress mark by convention — the stress information lives
 * in the VOWEL QUALITY (reduction + open/closed length), and that is precisely what this model learns: the rule
 * engine places stress correctly only 72.6% of the time overall and 36% at eight syllables, which is why the
 * residual it leaves is contextual rather than tabulable.
 *
 * On a 3,873-word dictionary-gold held-out split the tagger reads **91.4% exact / 98.7% symbol**, against the rule engine's
 * **63.5% / 93.5%** on the same dictionary-gold words — a 77% relative reduction in word error. Provenance, including why ~31k
 * training pairs is the ceiling for this language: af-g2p-tagger.PROVENANCE.md.
 *
 * The lazy-load + masked decode loop is the shared `createWordStructuralTagger` (core/structuralTagger.ts); this
 * file supplies only the af-specific preprocess. `onnxruntime-node` is optional; absent it (or the model),
 * createAfrikaansTagger() resolves to `undefined` and callers fall back to the sync path.
 */
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { createWordStructuralTagger, type WordStructuralTagger } from "../../core/structuralTagger.ts";

export type AfrikaansTagger = WordStructuralTagger;

/** Build the Afrikaans OOV tagger, or `undefined` if the model / onnxruntime-node is unavailable. */
export function createAfrikaansTagger(basename = "af-g2p-tagger"): Promise<AfrikaansTagger | undefined> {
    return createWordStructuralTagger({
        dir: dirname(fileURLToPath(import.meta.url)),
        basename,
        modelFile: `${basename}.int8.onnx`,
        context: "Afrikaans neural tagging",
        epEnv: "AF_ORT_EP",
        // lowercase + NFC so graphemes match the training vocab (the sync lexicon/rule paths also lowercase).
        preprocess: (w) => w.toLowerCase().normalize("NFC"),
    });
}

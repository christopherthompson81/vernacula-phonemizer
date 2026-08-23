/**
 * Sindhi G2P STRUCTURAL tagger — the neural OOV reader. A per-letter BiLSTM (ONNX) labelling each Perso-Arabic
 * letter with its IPA-chunk TAG (the consonant, COPIED, plus whatever short vowel follows it, or none), in a
 * SINGLE forward pass. Output length == input length, so it CANNOT degenerate and CANNOT break the consonant
 * skeleton the rule g2p already gets right — a per-letter CONSONANT-CONSISTENCY MASK limits each letter to the
 * tags it produced in training, so the model only ever decides the vowel.
 *
 * This is the OOV tier for the abjad's unwritten short vowels. A lexicon-covered word is served by the sync
 * lexicon (precedence: lexicon → tagger → default-ə rules); the tagger's target is the ~48% of FLEURS tokens the
 * lexicon does NOT cover, where the alternative is a blanket default [ə].
 *
 * Trained with the Devanagari INHERENT-vowel slots masked — see sd-g2p-tagger.PROVENANCE.md. Measured on
 * trustworthy labels: 77.0% slot / 67.4% word-exact, vs 71.4% for a next-letter bigram and 44.5% for always-ə.
 *
 * `onnxruntime-node` is an OPTIONAL dependency, imported lazily; if it — or the .onnx — is absent,
 * createSindhiTagger() resolves to `undefined` and callers fall back to the sync rule engine (no throw).
 */
import { dirname } from "node:path";

import { createWordStructuralTagger, type WordStructuralTagger } from "../../core/structuralTagger.ts";
import { dataDir } from "../../core/dataPath.ts";

export type SindhiTagger = WordStructuralTagger;

/** Build the Sindhi OOV tagger, or `undefined` if the model / onnxruntime-node is unavailable. */
export function createSindhiTagger(basename = "sd-g2p-tagger"): Promise<SindhiTagger | undefined> {
    return createWordStructuralTagger({
        dir: dataDir(import.meta.url),
        basename,
        modelFile: `${basename}.int8.onnx`,
        context: "Sindhi neural tagging",
        epEnv: "SD_ORT_EP",
        preprocess: (w) => w.normalize("NFC"),
    });
}

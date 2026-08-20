/**
 * Norwegian Bokmål OOV g2p STRUCTURAL tagger — the neural OOV reader. A per-grapheme BiLSTM (ONNX) that labels each
 * letter with its IPA-chunk TAG in a SINGLE forward pass. The tag alphabet INCLUDES the stress mark ˈ, so it predicts
 * stress POSITION + the stress-conditioned vowel quality directly from spelling — the deep-orthography win the sync
 * first-syllable rule heuristic can't reach. Output length == input length → it cannot degenerate; a per-grapheme
 * CONSONANT-CONSISTENCY MASK constrains each letter to the tags it produced in training.
 *
 * The lazy-load + masked decode loop is the shared `createWordStructuralTagger` (core/structuralTagger.ts); this file
 * supplies only the nb-specific bits: lowercase+NFC preprocess and the single-primary-stress `oneStress` postprocess.
 * A lexicon-covered word is served by the sync lexicon path instead (precedence lexicon → tagger → rules, in the async
 * phonemizeNbNeural). Held-out (full-word incl. stress) far outstrips the perceptron prototype (56.6%).
 * `onnxruntime-node` is optional; absent it (or the model),
 * createNorwegianTagger() resolves to `undefined` and callers fall back to the sync rule engine.
 */
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { createWordStructuralTagger, oneStress, type WordStructuralTagger } from "../../core/structuralTagger.ts";

export type NorwegianTagger = WordStructuralTagger;

// The vowel-phoneme set the rule engine uses for stress placement — passed to the shared `oneStress` so its no-stress
// fallback places ˈ before the first Norwegian vowel (unchanged from the pre-shared behaviour).
const VOWEL = /[ɑaeɛiɪoɔuʉʊyʏøœæ]/u;

/** Build the Norwegian OOV tagger, or `undefined` if the model / onnxruntime-node is unavailable. */
export function createNorwegianTagger(basename = "nb-g2p-tagger"): Promise<NorwegianTagger | undefined> {
    return createWordStructuralTagger({
        dir: dirname(fileURLToPath(import.meta.url)),
        basename,
        modelFile: `${basename}.int8.onnx`,
        context: "Norwegian neural tagging",
        epEnv: "NB_ORT_EP",
        // lowercase + NFC so graphemes match the training vocab (the sync lexicon/rule paths also lowercase). The vocab
        // covers every letter the nb TOKEN/WORD class admits, so the decline is unreachable via phonemizeNbNeural — it
        // is the defensive guard for a caller handing tag() foreign graphemes, and the net if that class is widened.
        preprocess: (w) => w.toLowerCase().normalize("NFC"),
        postprocess: (ipa) => oneStress(ipa, VOWEL), // guarantee exactly one primary ˈ (the lexicon/rule tiers' invariant)
    });
}

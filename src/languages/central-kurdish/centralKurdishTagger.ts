/**
 * Central Kurdish BIZROKE tagger — the neural OOV tier for Sorani's one unwritten vowel. A BiLSTM (ONNX)
 * labelling each code point of THIS ENGINE'S OWN RULE OUTPUT with either itself or itself + /ɪ/, in a single
 * forward pass.
 *
 * ⚠ THE INPUT IS `phonemizeWordRules`, NOT THE ORTHOGRAPHY — unusual among the fleet's taggers, and load-bearing
 * twice over. The consonant-consistency mask in core/structuralTagger.ts limits every symbol to the tags it
 * emitted in training, and the only tags any symbol ever emitted are itself and itself+ɪ: the model therefore
 * CANNOT alter, delete, or reorder a consonant — the single decision it is capable of making is where the
 * bizroke goes. And because the rules path is the input rather than the lexicon path, the ckb referee eval
 * (which runs `phonemizeWordRules`) stays non-circular.
 *
 * Precedence is lexicon → tagger → rules: a word the AsoSoft-derived lexicon covers is served from there.
 * The tagger's target is the ~2,000 corpus word types beyond it — the source is 10,041 words and exhausted.
 *
 * Measured 95.1% word-exact against a 73.8% never-insert baseline on a STEM-BLIND held-out split (a random
 * split reads 2pp higher and is a lie — Sorani's inflected families would straddle it). That split is the ONLY
 * instrument available: ckb.jsonc folds `[əɪ]` on both sides because the two human referees disagree on the
 * vowel's quality, and the ASR under-transcribes Sorani. See ckb-bizroke-tagger.PROVENANCE.md.
 *
 * `onnxruntime-node` is an OPTIONAL dependency, imported lazily; if it — or the .onnx — is absent,
 * createCentralKurdishTagger() resolves to `undefined` and callers fall back to the sync engine (no throw).
 */
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { createWordStructuralTagger, type WordStructuralTagger } from "../../core/structuralTagger.ts";
import { phonemizeWordRules } from "./central-kurdish.ts";

export type CentralKurdishTagger = WordStructuralTagger;

/** Build the ckb bizroke tagger, or `undefined` if the model / onnxruntime-node is unavailable. */
export function createCentralKurdishTagger(basename = "ckb-bizroke-tagger"): Promise<CentralKurdishTagger | undefined> {
    return createWordStructuralTagger({
        dir: dirname(fileURLToPath(import.meta.url)),
        basename,
        modelFile: `${basename}.int8.onnx`,
        context: "Central Kurdish neural tagging",
        epEnv: "CKB_ORT_EP",
        // ⚠ the tagger reads IPA, not orthography — see the header. An unseen symbol has no entry in `src`,
        // so the shared factory declines the word and the rule reading stands.
        preprocess: phonemizeWordRules,
    });
}

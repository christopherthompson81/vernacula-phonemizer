/**
 * Central Kurdish BIZROKE tagger — the neural OOV tier for Sorani's one unwritten vowel. A BiLSTM (ONNX)
 * labelling each code point of THIS ENGINE'S OWN RULE OUTPUT with either itself or itself + /ɪ/, in a single
 * forward pass.
 *
 * ⚠ THE INPUT IS `phonemizeWordRules`, NOT THE ORTHOGRAPHY — unusual among the fleet's taggers, and load-bearing
 * twice over. The consonant-consistency mask in core/structuralTagger.ts limits every symbol to the tags it
 * emitted in training, and the only tags any symbol ever emitted are itself and itself+ɪ: the model therefore
 * CANNOT alter, delete, or reorder a consonant — the single decision it is capable of making is where the
 * bizroke goes. And it composes with the rule engine without an alignment step, since its input IS that
 * engine's output.
 *
 * ⚠ NON-CIRCULARITY HERE IS BY SOURCE, NOT BY TIER. The ckb referee eval runs this whole stack — lexicon,
 * tagger, rules — rather than `phonemizeWordRules` alone, which is the usual arrangement for a language whose
 * lexicon was mined from its referee. It can, because nothing in this tier comes from wikipron or kaikki: the
 * lexicon and the training pairs are both AsoSoft. Do not "fix" the eval to rules-only by analogy with
 * sd/bn/af — it would stop measuring the tier without buying any independence.
 *
 * Precedence is lexicon → tagger → rules: a word the AsoSoft-derived lexicon covers is served from there.
 * The tagger's target is the ~2,000 corpus word types beyond it — the source is 10,041 words and exhausted.
 *
 * Measured 96.6% word-exact against a 73.8% never-insert baseline on a STEM-BLIND held-out split (grouped by
 * the first 5 characters, so Sorani's inflected families cannot straddle it — a random split reads 98.2%
 * against 96.7% measured the same way, and that 1.5pp is leakage). CONFIRMED EXTERNALLY
 * once `ckb.jsonc` stopped folding `[əɪ]` to nothing and started normalising it to ə: on the folded backbone
 * this tier scores 85.2% (wikipron) / 85.0% (kaikki) against the lexicon-only 74.8% / 73.6% and the rules-only
 * 72.3% / 71.2% — referees that had no part in building it (though not, it turns out, independent of each
 * other: both scrape en.wiktionary and agree with each other on 99.2% of the 972 words they share).
 * See ckb-bizroke-tagger.PROVENANCE.md.
 *
 * `onnxruntime-node` is an OPTIONAL dependency, imported lazily; if it — or the .onnx — is absent,
 * createCentralKurdishTagger() resolves to `undefined` and callers fall back to the sync engine (no throw).
 */

import { createWordStructuralTagger, type WordStructuralTagger } from "../../core/structuralTagger.ts";
import { phonemizeWordRules } from "./central-kurdish.ts";
import { dataDir } from "../../core/dataPath.ts";

export type CentralKurdishTagger = WordStructuralTagger;

/** Build the ckb bizroke tagger, or `undefined` if the model / onnxruntime-node is unavailable. */
export function createCentralKurdishTagger(basename = "ckb-bizroke-tagger"): Promise<CentralKurdishTagger | undefined> {
    return createWordStructuralTagger({
        dir: dataDir(import.meta.url),
        basename,
        modelFile: `${basename}.int8.onnx`,
        context: "Central Kurdish neural tagging",
        epEnv: "CKB_ORT_EP",
        // ⚠ the tagger reads IPA, not orthography — see the header. An unseen symbol has no entry in `src`,
        // so the shared factory declines the word and the rule reading stands.
        preprocess: phonemizeWordRules,
        // ⚠ NO `postprocess` STRIPPING WORD-FINAL ɪ, AND THE REASON IS WORTH KEEPING. The first model emitted
        // a word-final bizroke on 2.4% of referee vocabulary and 1.1% of FLEURS ckb types against 0.1% in its
        // own training data, and a `.replace(/ɪ$/, "")` here bought +1.9pp. That was a symptom: the trainer
        // ran the BiLSTM over PADDED batches without pack_padded_sequence, so the backward direction crossed
        // pad steps before reaching each word's last real symbol while serving (batch=1, unpadded) starts it
        // cleanly there — damage landing precisely at the end of the word. Packing the sequences took the
        // final-ɪ rate to 0.1% / 0.0%, i.e. to the training data's own rate, and held-out word-exact from
        // 95.1% to 96.6%. With the cause fixed the strip is worth ONE word and would suppress the genuine
        // final bizroke, so it is gone. Treat the cause.
    });
}

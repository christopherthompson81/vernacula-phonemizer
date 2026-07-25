/**
 * Danish OOV g2p STRUCTURAL tagger — the neural OOV reader. A per-grapheme BiLSTM (ONNX) that labels each letter with
 * its IPA-chunk TAG in a SINGLE forward pass, replacing the averaged-perceptron OOV tier. The perceptron was
 * data-starved on the old 7.5k Wiktionary lexicon (it merely tied the rule engine); trained on the full 199k NST
 * (Nasjonalbiblioteket, CC0) a BiLSTM is un-starved (~96% symbol held-out) and matches the NST NARROW convention
 * (r-vocalisation ɐ, stop lenition, soft-d ð, length ː, stød ˀ). The tagger is a thin wrapper over the shared
 * `createWordStructuralTagger`: a lowercase+NFC preprocess and the shared `oneStress` postprocess (the stress mark is
 * in the tag alphabet, so a raw reading can carry zero/doubled/multiple primaries — normalise to one, like nb). A
 * per-letter consonant mask keeps every output plausible.
 *
 * `onnxruntime-node` is an OPTIONAL dependency, imported lazily; if it — or the model — is absent, createDanishTagger()
 * resolves to `undefined` and the async path (daNeural.ts) falls back to the sync rule engine. See
 * docs/investigations/da_nst_ingest_investigation.md.
 */
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { createWordStructuralTagger, oneStress, type WordStructuralTagger } from "../../core/structuralTagger.ts";

export type DanishTagger = WordStructuralTagger;

// Danish vowel-phoneme set for oneStress's no-stress fallback — incl. ə/ɐ/ɒ (reduced, r-vocalised, back-round) beyond
// the shared default so a mark-less reading still gets ˈ before its first vowel.
const VOWEL = /[ɑaeɛiɪoɔuʉʊyʏøœæəɐɒ]/u;

/** Build the Danish OOV tagger, or `undefined` if the model / onnxruntime-node is unavailable. */
export function createDanishTagger(basename = "da-g2p-tagger"): Promise<DanishTagger | undefined> {
    return createWordStructuralTagger({
        dir: dirname(fileURLToPath(import.meta.url)),
        basename,
        modelFile: `${basename}.int8.onnx`,
        context: "Danish neural OOV G2P",
        epEnv: "DA_ORT_EP",
        // lowercase + NFC so letters match the training vocab (NST words are precomposed å/æ/ø).
        preprocess: (w) => w.toLowerCase().normalize("NFC"),
        // the per-position argmax has no global stress constraint, so a raw reading can carry zero / doubled (ˌˌ) /
        // multiple primary marks (vandby→ˈvanˌˌbyː, underdør→ˈɔnɐˈdœɐˀ); normalise to exactly one ˈ like the lexicon
        // and rule tiers (length ː / stød ˀ stay — they are not stress marks).
        postprocess: (ipa) => oneStress(ipa, VOWEL),
    });
}

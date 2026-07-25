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
 * phonemizeNbNeural). Held-out (full-word incl. stress) far outstrips the perceptron prototype (56.6%). See
 * docs/investigations/nb_native_bringup_investigation.md. `onnxruntime-node` is optional; absent it (or the model),
 * createNorwegianTagger() resolves to `undefined` and callers fall back to the sync rule engine.
 */
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { createWordStructuralTagger, type WordStructuralTagger } from "../../core/structuralTagger.ts";

export type NorwegianTagger = WordStructuralTagger;

const VOWEL = /[ɑaeɛiɪoɔuʉʊyʏøœæ]/u; // the same vowel-phoneme set the rule engine uses for stress placement

/**
 * Enforce EXACTLY ONE primary stress on the concatenated per-letter tags. The tag alphabet embeds ˈ, but the
 * per-position argmax has no global stress constraint, so the raw output can carry adjacent-doubled (`ˈˈ`), zero, or
 * two primary marks (paella→`pɑˈˈɛlɑ`, entrepreneur→no ˈ, cappuccino→two). The lexicon and rule tiers both guarantee a
 * single ˈ; this makes the tagger output convention-consistent so the shipped OOV IPA never violates it. Keep the
 * FIRST primary and drop later ones (over-emitted; legitimately-emitted secondary ˌ are kept); if none survives,
 * promote the first secondary, else place ˈ before the first vowel's onset (the rule-engine default).
 */
export function oneStress(ipa: string): string {
    // collapse any run of adjacent stress marks to one (primary wins): ˈˈ / ˈˌ / ˌˈ → ˈ, ˌˌ → ˌ
    ipa = ipa.replace(/[ˈˌ]{2,}/gu, (m) => (m.includes("ˈ") ? "ˈ" : "ˌ"));
    let seen = false;
    ipa = ipa.replace(/ˈ/gu, () => (seen ? "" : ((seen = true), "ˈ"))); // keep the first ˈ, drop the rest
    if (seen) return ipa;
    if (ipa.includes("ˌ")) return ipa.replace("ˌ", "ˈ"); // no primary → promote the first secondary
    const m = VOWEL.exec(ipa); // still none → ˈ before the first vowel's onset (matches phonemizeWordRules)
    if (!m) return ipa;
    let onset = m.index;
    while (onset > 0 && !VOWEL.test(ipa[onset - 1]!)) onset--;
    return ipa.slice(0, onset) + "ˈ" + ipa.slice(onset);
}

/** Build the Norwegian OOV tagger, or `undefined` if the model / onnxruntime-node is unavailable. */
export function createNorwegianTagger(basename = "nb-g2p-tagger"): Promise<NorwegianTagger | undefined> {
    return createWordStructuralTagger({
        dir: dirname(fileURLToPath(import.meta.url)),
        basename,
        modelFile: `${basename}.onnx`,
        context: "Norwegian neural tagging",
        epEnv: "NB_ORT_EP",
        // lowercase + NFC so graphemes match the training vocab (the sync lexicon/rule paths also lowercase). The vocab
        // covers every letter the nb TOKEN/WORD class admits, so the decline is unreachable via phonemizeNbNeural — it
        // is the defensive guard for a caller handing tag() foreign graphemes, and the net if that class is widened.
        preprocess: (w) => w.toLowerCase().normalize("NFC"),
        postprocess: oneStress, // guarantee exactly one primary ˈ (the lexicon/rule tiers' invariant)
    });
}

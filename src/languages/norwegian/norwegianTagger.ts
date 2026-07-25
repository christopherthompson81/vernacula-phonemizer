/**
 * Norwegian Bokmål OOV g2p STRUCTURAL tagger — the neural OOV reader. A per-grapheme BiLSTM (ONNX) that labels each
 * letter with its IPA-chunk TAG in a SINGLE forward pass. The tag alphabet INCLUDES the stress mark ˈ, so the
 * bidirectional pass predicts stress POSITION and the stress-conditioned vowel quality DIRECTLY from spelling — the
 * deep-orthography contrast (open/closed-syllable length, non-initial loanword stress) that the sync first-syllable
 * rule heuristic can't recover. Output length == input length → it cannot degenerate; a per-grapheme
 * CONSONANT-CONSISTENCY MASK (charTags) constrains each letter to the tags it produced in training, so the model only
 * ever decides the vowel/stress decoration, never an arbitrary consonant.
 *
 * This is the OOV GENERALISATION tier: the words the NST pronunciation lexicon (nb-lexicon.tsv) misses. A
 * lexicon-covered word is served by the sync lexicon path instead (precedence: lexicon → tagger → rule engine, in the
 * async phonemizeNbNeural). On the seed-0 held-out (OOV) split it far outstrips the averaged-perceptron prototype
 * (56.6%) and the rule engine. See docs/investigations/nb_native_bringup_investigation.md.
 *
 * `onnxruntime-node` is an OPTIONAL dependency, imported lazily; if it — or the .onnx model — is absent,
 * createNorwegianTagger() resolves to `undefined` and callers fall back to the sync rule engine (no throw).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadOrt, type OrtLike, type OrtSession } from "../../core/onnx.ts";
import { maskedArgmax, type TaggerMeta } from "../../core/structuralTagger.ts";

export interface NorwegianTagger {
    /** A bare Norwegian word → canonical IPA WITH stress, or "" to defer to the rule engine (OOV grapheme). */
    tag(word: string): Promise<string>;
}

const VOWEL = /[ɑaeɛiɪoɔuʉʊyʏøœæ]/u; // the same vowel-phoneme set the rule engine uses for stress placement

/**
 * Enforce EXACTLY ONE primary stress on the concatenated per-letter tags. The tag alphabet embeds ˈ, but the
 * per-position argmax has no global stress constraint, so the raw output can carry adjacent-doubled (`ˈˈ`), zero, or
 * two primary marks (paella→`pɑˈˈɛlɑ`, entrepreneur→no ˈ, cappuccino→two). The lexicon and rule tiers both guarantee a
 * single ˈ; this makes the tagger output convention-consistent so the shipped OOV IPA never violates it. Keep the
 * FIRST primary and drop later ones (over-emitted; legitimately-emitted secondary ˌ are kept); if none survives,
 * promote the first secondary, else place ˈ before the first vowel's onset (the rule-engine default).
 */
function oneStress(ipa: string): string {
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
export async function createNorwegianTagger(basename = "nb-g2p-tagger"): Promise<NorwegianTagger | undefined> {
    const dir = dirname(fileURLToPath(import.meta.url));
    let meta: TaggerMeta, modelBytes: Uint8Array;
    try {
        meta = JSON.parse(readFileSync(join(dir, `${basename}.meta.json`), "utf8")) as TaggerMeta;
        modelBytes = readFileSync(join(dir, `${basename}.onnx`));
    } catch { return undefined; }
    let ortLib: OrtLike, sess: OrtSession;
    try {
        ortLib = await loadOrt("Norwegian neural tagging");
        // Shipping default is CPU. Opt into a GPU execution provider (fast eval iteration) with NB_ORT_EP=cuda.
        const ep = process.env.NB_ORT_EP;
        sess = await ortLib.InferenceSession.create(modelBytes, ep ? { executionProviders: ep.split(",") } : undefined);
    } catch { return undefined; }
    const nTags = Object.keys(meta.tags).length;

    return {
        async tag(word: string): Promise<string> {
            // lowercase + NFC so graphemes match the training vocab (the sync lexicon/rule paths also lowercase).
            const chars = [...word.toLowerCase().normalize("NFC")];
            const T = chars.length;
            if (T === 0) return "";
            // DECLINE (return "") on any grapheme outside the training vocab: its letter is not in the mask, so tagging
            // it would emit an arbitrary tag and override the correct rule reading. "" = "defer to the rule engine".
            // (Coverage contract: meta.src covers every letter the nb TOKEN/WORD class admits, so this is unreachable
            // via phonemizeNbNeural today — it's the defensive guard for a caller passing tag() foreign graphemes, and
            // the net if that letter class is ever widened.)
            const ids = new Array<number>(T);
            for (let i = 0; i < T; i++) {
                const id = meta.src[chars[i]!];
                if (id === undefined) return "";
                ids[i] = id;
            }
            const r = await sess.run({ chars: new ortLib.Tensor("int64", BigInt64Array.from(ids, (x) => BigInt(x)), [1, T]) });
            const logits = r.logits!.data as Float32Array; // flat [T * nTags], row-major (t·nTags + tag)
            let out = "";
            for (let k = 0; k < T; k++) {
                // Masked argmax over ONLY this letter's permitted tags (the consonant mask, pad-excluded). A -1 (no
                // permitted tag) means decline the whole word → defer to rules.
                const best = maskedArgmax(logits, k * nTags, meta.charTags[String(ids[k])]);
                if (best < 0) return "";
                out += meta.tags[String(best)] ?? "";
            }
            return oneStress(out); // guarantee exactly one primary ˈ (the lexicon/rule tiers' invariant)
        },
    };
}

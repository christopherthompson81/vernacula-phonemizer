/**
 * Bengali G2P STRUCTURAL tagger — the neural OOV reader. A per-grapheme BiLSTM (ONNX) that labels each Bengali
 * grapheme with its IPA-chunk TAG (the consonant, COPIED, plus the following inherent vowel ɔ/o or its deletion),
 * run as a SINGLE forward pass. Because output length == input length it CANNOT degenerate and CANNOT break the
 * consonant skeleton — no beam, no autoregressive decode, no degeneration guard. The whole-word ɔ/o realization
 * comes from the bidirectional pass; a per-grapheme CONSONANT-CONSISTENCY MASK constrains each grapheme to only the
 * tags it produced in training (ক → k/kɔ/ko, never ʃ), so the model only ever decides the vowel.
 *
 * This is the OOV GENERALISATION tier: it fills the words the authoritative Kolkata gold + cross-source consensus
 * lexicon (bengali-lexicon.tsv) miss. A lexicon-covered word is served by the sync lexicon path instead
 * (precedence: lexicon → tagger → rule engine). On the seed-0 held-out (OOV) split it reads ɔ/o 90.5% | full 86.4%
 * vs the rule engine's 62.6% ɔ/o. See bn-g2p-tagger.PROVENANCE.md and bn_native_bringup_investigation.md Run 17-18.
 *
 * `onnxruntime-node` is an OPTIONAL dependency, imported lazily; if it — or the .onnx model — is absent,
 * createBengaliTagger() resolves to `undefined` and callers fall back to the sync rule engine (no throw).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface OrtTensor { data: Float32Array | BigInt64Array }
interface OrtSession { run(feeds: Record<string, unknown>): Promise<Record<string, OrtTensor>> }
interface OrtLike {
    InferenceSession: { create(model: Uint8Array, options?: { executionProviders: string[] }): Promise<OrtSession> };
    Tensor: new (type: string, data: BigInt64Array, dims: number[]) => OrtTensor;
}
let ortPromise: Promise<OrtLike> | undefined;
const ort = (): Promise<OrtLike> => (ortPromise ??= import("onnxruntime-node").then((m) => (m.default ?? m) as unknown as OrtLike));

/**
 * `src`: grapheme → id (includes `<pad>`=0, `<unk>`=1). `tags`: tag-id → IPA chunk. `charTags`: grapheme-id → the
 * tag-ids that grapheme may emit (the consonant mask; an unseen grapheme maps to all tag-ids). Emitted by
 * tools/bengali/export_bn_tagger_onnx.py.
 */
interface TaggerMeta { src: Record<string, number>; tags: Record<string, string>; charTags: Record<string, number[]> }

export interface BengaliTagger {
    /** A bare Bengali word → canonical IPA (no stress mark; matches the sync engine's default render). */
    tag(word: string): Promise<string>;
}

/** Build the Bengali OOV tagger, or `undefined` if the model / onnxruntime-node is unavailable. */
export async function createBengaliTagger(basename = "bn-g2p-tagger"): Promise<BengaliTagger | undefined> {
    const dir = dirname(fileURLToPath(import.meta.url));
    let meta: TaggerMeta, modelBytes: Uint8Array;
    try {
        meta = JSON.parse(readFileSync(join(dir, `${basename}.meta.json`), "utf8")) as TaggerMeta;
        modelBytes = readFileSync(join(dir, `${basename}.int8.onnx`));
    } catch { return undefined; }
    let ortLib: OrtLike, sess: OrtSession;
    try {
        ortLib = await ort();
        // Shipping default is CPU. Opt into a GPU execution provider (fast eval iteration) with BN_ORT_EP=cuda.
        const ep = process.env.BN_ORT_EP;
        sess = await ortLib.InferenceSession.create(modelBytes, ep ? { executionProviders: ep.split(",") } : undefined);
    } catch { return undefined; }
    const nTags = Object.keys(meta.tags).length;

    return {
        async tag(word: string): Promise<string> {
            // NFC-normalize so the graphemes match the training vocab (the sync lexicon/rule paths also NFC).
            const chars = [...word.normalize("NFC")];
            const T = chars.length;
            if (T === 0) return "";
            // DECLINE (return "") on any grapheme outside the training vocab: its consonant is not in the mask, so
            // tagging it would emit an arbitrary consonant and override the correct rule-engine reading. The caller
            // treats "" as "defer to the rule engine" for the whole word.
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
                // Argmax over ONLY this grapheme's permitted tags (the consonant mask, pad-excluded): keeps every
                // consonant canonical and makes the choice a cheap scan of ~3 candidates instead of all ~160 tags.
                const valid = meta.charTags[String(ids[k])];
                if (!valid || valid.length === 0) return ""; // no permitted tag → decline (defer to rules)
                const base = k * nTags;
                let best = valid[0]!, bestLo = logits[base + best]!;
                for (let j = 1; j < valid.length; j++) {
                    const t = valid[j]!, v = logits[base + t]!;
                    if (v > bestLo) { bestLo = v; best = t; }
                }
                out += meta.tags[String(best)] ?? "";
            }
            return out;
        },
    };
}

/**
 * Hebrew PHASE-2 tagger — the neural VOWEL RESTORER for UNVOCALIZED Hebrew. A per-consonant BiLSTM (ONNX) that
 * labels each skeleton letter of bare consonantal Hebrew with its IPA-chunk TAG (consonant + the restored vowel),
 * run as a SINGLE forward pass. Because output length == input length it CANNOT degenerate; the whole-word
 * bidirectional pass supplies the context that disambiguates the unwritten vowels. A per-consonant
 * consonant-consistency MASK constrains each letter to only the tags it produced in training (⟨ב⟩ → b… or v…,
 * never a ⟨ק⟩ tag), so the consonant skeleton stays canonical and the model only restores the vowels.
 *
 * This is the Phase-2 counterpart to the Phase-1 niqqud→IPA g2p (hebrew.ts): Phase 1 reads VOCALIZED (pointed)
 * Hebrew deterministically; this reads UNVOCALIZED Hebrew (everyday text). Shares core/onnx.ts + the masked-argmax
 * decode with the fa/bn taggers (core/structuralTagger.ts). See src/hebrewNeural.ts + he-tagger.PROVENANCE.md.
 *
 * `onnxruntime-node` is OPTIONAL (lazy import); if it — or the model — is absent, createHebrewTagger() resolves to
 * `undefined` and the caller falls back to the sync (vocalized-only) engine.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadOrt, type OrtLike, type OrtSession } from "../../core/onnx.ts";
import { maskedArgmax, type TaggerMeta } from "../../core/structuralTagger.ts";

export interface HebrewTagger {
    /** A bare (unvocalized) Hebrew word → restored Modern Israeli IPA (no stress). "" if the model declines. */
    tag(word: string): Promise<string>;
}

/** Build the Hebrew OOV/unvocalized tagger, or `undefined` if the model / onnxruntime-node is unavailable. */
export async function createHebrewTagger(basename = "he-tagger"): Promise<HebrewTagger | undefined> {
    const dir = dirname(fileURLToPath(import.meta.url));
    let meta: TaggerMeta, modelBytes: Uint8Array;
    try {
        meta = JSON.parse(readFileSync(join(dir, `${basename}.meta.json`), "utf8")) as TaggerMeta;
        modelBytes = readFileSync(join(dir, `${basename}.int8.onnx`));
    } catch { return undefined; }
    let ortLib: OrtLike, sess: OrtSession;
    try {
        ortLib = await loadOrt("Hebrew neural restoration");
        const ep = process.env.HE_ORT_EP; // shipping default CPU; opt into a GPU EP for fast eval
        sess = await ortLib.InferenceSession.create(modelBytes, ep ? { executionProviders: ep.split(",") } : undefined);
    } catch { return undefined; }
    const nTags = Object.keys(meta.tags).length;

    return {
        async tag(word: string): Promise<string> {
            const chars = [...word.normalize("NFC")];
            const T = chars.length;
            if (T === 0) return "";
            // Every char must be a known skeleton letter; a stray/foreign char → decline (defer to the sync engine).
            const ids = new Array<number>(T);
            for (let i = 0; i < T; i++) {
                const id = meta.src[chars[i]!];
                if (id === undefined) return "";
                ids[i] = id;
            }
            const r = await sess.run({ chars: new ortLib.Tensor("int64", BigInt64Array.from(ids, (x) => BigInt(x)), [1, T]) });
            const logits = r.logits!.data as Float32Array; // flat [T·nTags], row-major
            let out = "";
            for (let k = 0; k < T; k++) {
                const best = maskedArgmax(logits, k * nTags, meta.charTags[String(ids[k])]);
                if (best < 0) return "";
                out += meta.tags[String(best)] ?? "";
            }
            return out;
        },
    };
}

/**
 * Persian STRUCTURAL TAGGER — the DEFAULT modern fa restorer. A sentence-level BiLSTM sequence-labeller that emits
 * one IPA-chunk TAG per abjad char (the char's consonant, COPIED, plus its following short vowel / ezafe), then
 * assembles the tags into words on the space chars. Because output length == input length, it CANNOT degenerate and
 * CANNOT break the consonant skeleton — a single forward pass, no beam, no autoregressive decode loop, no
 * degeneration guard. Context (ezafe / homographs) comes from the bidirectional pass.
 *
 * It REPLACES the modern seq2seq context restorer. On the CANONICAL held-out (the fair gold — colloquial
 * fusions/elisions no canonical phonemizer would produce are excluded) it measures 93.6% per-word vs the seq2seq's
 * 92.5% on that same subset, with 0% catastrophic degeneration (the seq2seq's ~1.4% runaway-loop risk) at ~3MB vs
 * ~5MB. A per-char CONSONANT-CONSISTENCY MASK constrains each char to only the tags whose consonant it produced in
 * training (ص→s, never ʃ; غ→ɣ, never the colloquial ɡ), so the output is always canonical. See
 * fa-tagger.PROVENANCE.md and docs/investigations/fa_shortvowel_restoration_investigation.md.
 *
 * `onnxruntime-node` is optional (lazy import); createFaTagger() resolves to `undefined` (no-op) if it or the model
 * is absent — identical to the seq2seq restorer's contract, so callers fall back to the word-level path.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stressPerWord, type FaContextRestorer } from "./contextRestorer.ts";

interface OrtTensor { data: Float32Array | BigInt64Array }
interface OrtSession { run(feeds: Record<string, unknown>): Promise<Record<string, OrtTensor>> }
interface OrtLike {
    InferenceSession: { create(model: Uint8Array, options?: { executionProviders: string[] }): Promise<OrtSession> };
    Tensor: new (type: string, data: BigInt64Array, dims: number[]) => OrtTensor;
}
let ortPromise: Promise<OrtLike> | undefined;
const ort = (): Promise<OrtLike> => (ortPromise ??= import("onnxruntime-node").then((m) => (m.default ?? m) as unknown as OrtLike));

/**
 * `src`: char → id (includes `<pad>`=0, `<unk>`=1). `tags`: tag-id → IPA chunk (the space tag `" "` marks a word
 * boundary, dropped in assembly). `charTags`: char-id → the tag-ids that char may emit (the consonant mask; an
 * unseen char maps to all tag-ids). Emitted by tools/fa-restoration/export_tagger_onnx.py.
 */
interface TaggerMeta { src: Record<string, number>; tags: Record<string, string>; charTags: Record<string, number[]> }

/** Build the structural tagger, or `undefined` if the model / onnxruntime-node is unavailable. */
export async function createFaTagger(basename = "fa-tagger"): Promise<FaContextRestorer | undefined> {
    const dir = dirname(fileURLToPath(import.meta.url));
    let meta: TaggerMeta, modelBytes: Uint8Array;
    try {
        meta = JSON.parse(readFileSync(join(dir, `${basename}.meta.json`), "utf8")) as TaggerMeta;
        modelBytes = readFileSync(join(dir, `${basename}.int8.onnx`));
    } catch { return undefined; }
    let ortLib: OrtLike, sess: OrtSession;
    try {
        ortLib = await ort();
        // Shipping default is CPU. Opt into a GPU execution provider (fast eval iteration) with FA_ORT_EP=cuda.
        const ep = process.env.FA_ORT_EP;
        sess = await ortLib.InferenceSession.create(modelBytes, ep ? { executionProviders: ep.split(",") } : undefined);
    } catch { return undefined; }
    const UNK = meta.src["<unk>"] ?? 1;
    const nTags = Object.keys(meta.tags).length;

    return {
        async restore(sentence: string): Promise<string> {
            const chars = [...sentence];
            const T = chars.length;
            if (T === 0) return "";
            const ids = BigInt64Array.from(chars.map((c) => BigInt(meta.src[c] ?? UNK)));
            const r = await sess.run({ chars: new ortLib.Tensor("int64", ids, [1, T]) });
            const logits = r.logits!.data as Float32Array; // flat [T * nTags], row-major (t·nTags + tag)
            const words: string[] = [""];
            for (let k = 0; k < T; k++) {
                if (chars[k] === " ") { words.push(""); continue; } // word boundary → new word, no tag emitted
                const id = meta.src[chars[k]!] ?? UNK;
                // Argmax over ONLY this char's permitted tags (the consonant mask): keeps every consonant canonical
                // and makes the choice a cheap scan of ~8 candidates instead of all ~1200 tags.
                const valid = meta.charTags[String(id)];
                const base = k * nTags;
                let best = valid?.[0] ?? 0, bestLo = logits[base + best]!;
                for (const t of valid ?? []) { const v = logits[base + t]!; if (v > bestLo) { bestLo = v; best = t; } }
                const tag = meta.tags[String(best)] ?? "";
                if (tag !== " ") words[words.length - 1] += tag;
            }
            return stressPerWord(words.join(" "));
        },
    };
}

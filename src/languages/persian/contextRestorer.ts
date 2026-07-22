/**
 * Persian CONTEXT restorer — a SENTENCE-level char seq2seq (BiLSTM encoder + attention decoder) that maps a whole
 * Persian abjad hemistich to IPA, resolving the homograph / ezafe / connector ambiguities that only sentence
 * context fixes (Run 5). Unlike the word-level vowelRestorer, this reads the whole sentence.
 *
 * ⚠ CLASSICAL-Persian scoped. Trained on the aligned-Shahnameh corpus — it is EXCELLENT in-domain (+18.8pp over
 * word-level, nails ezafe) but can HALLUCINATE on short/modern out-of-domain text. It is therefore an OPTIONAL
 * path (createFaContextRestorer + phonemizeFaContext in faNeural.ts), NOT wired into the default modern runtime.
 * Shipping a modern context restorer needs modern contextualised data. See the fa restoration investigation doc
 * and src/languages/persian/fa-context-restorer.PROVENANCE.md.
 *
 * `onnxruntime-node` is optional (lazy import); createFaContextRestorer() resolves to `undefined` (no-op) if it or
 * the .onnx models are absent. Output is already Iranian (trained on the Iranian-normalised corpus); this adds
 * per-word final stress to match the sync g2p convention.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface OrtTensor { data: Float32Array | BigInt64Array | Uint8Array }
interface OrtSession { run(feeds: Record<string, unknown>): Promise<Record<string, OrtTensor>> }
interface OrtLike {
    InferenceSession: { create(path: string | Uint8Array, options?: { executionProviders: string[] }): Promise<OrtSession> };
    Tensor: new (type: string, data: BigInt64Array | Float32Array | Uint8Array, dims: number[]) => OrtTensor;
}
let ortPromise: Promise<OrtLike> | undefined;
const ort = (): Promise<OrtLike> => (ortPromise ??= import("onnxruntime-node").then((m) => (m.default ?? m) as unknown as OrtLike));

interface Meta { src: Record<string, number>; tgt: Record<string, number>; H: number; bos: number; eos: number; unk: number }

export interface FaContextRestorer {
    /** A Persian abjad sentence/hemistich → restored Iranian IPA (per-word final stress). */
    restore(sentence: string): Promise<string>;
}

const VOWEL_G = /[aeiouɒæ]ː?/gu;
/** Mark Persian final stress on the last vowel of each space-separated word. Shared with the structural tagger. */
export function stressPerWord(ipa: string): string {
    return ipa.split(" ").map((w) => {
        const vs = [...w.matchAll(VOWEL_G)];
        if (!vs.length) return w;
        const last = vs[vs.length - 1]!.index;
        return w.slice(0, last) + "ˈ" + w.slice(last);
    }).join(" ");
}

/**
 * Build the CLASSICAL Persian CONTEXT restorer ("fa-context-restorer", aligned-Shahnameh silver, excellent on
 * verse), or `undefined` if the model / onnxruntime-node is unavailable. The MODERN sentence-level path is now the
 * structural tagger (faTagger.ts), which superseded the former "fa-context-modern" seq2seq — this factory is
 * classical-only. `basename` is retained for symmetry / test overrides.
 */
export async function createFaContextRestorer(basename = "fa-context-restorer"): Promise<FaContextRestorer | undefined> {
    const dir = dirname(fileURLToPath(import.meta.url));
    let meta: Meta, encBytes: Uint8Array, decBytes: Uint8Array;
    try {
        meta = JSON.parse(readFileSync(join(dir, `${basename}.meta.json`), "utf8")) as Meta;
        encBytes = readFileSync(join(dir, `${basename}.enc.onnx`));
        decBytes = readFileSync(join(dir, `${basename}.dec.onnx`));
    } catch { return undefined; }
    let ortLib: OrtLike, enc: OrtSession, dec: OrtSession;
    try {
        ortLib = await ort();
        // Shipping default is CPU (no CUDA dependency). Opt into a GPU execution provider — e.g. for fast
        // test/eval iteration — with FA_ORT_EP=cuda (or webgpu); needs the CUDA runtime libs on LD_LIBRARY_PATH.
        const ep = process.env.FA_ORT_EP;
        const opts = ep ? { executionProviders: ep.split(",") } : undefined;
        enc = await ortLib.InferenceSession.create(encBytes, opts);
        dec = await ortLib.InferenceSession.create(decBytes, opts);
    } catch { return undefined; }
    const i2t: Record<number, string> = {};
    for (const [k, v] of Object.entries(meta.tgt)) i2t[v] = k;
    const Z = 2 * meta.H;

    return {
        async restore(sentence: string): Promise<string> {
            const ids = BigInt64Array.from([...sentence].map((ch) => BigInt(meta.src[ch] ?? meta.unk)));
            const T = ids.length;
            if (T === 0) return "";
            const eo = (await enc.run({ tokens: new ortLib.Tensor("int64", ids, [1, T]) })).enc_o as unknown;
            const mask = new ortLib.Tensor("bool", Uint8Array.from(new Array(T).fill(1)), [1, T]);
            let h = new ortLib.Tensor("float32", new Float32Array(Z), [1, 1, Z]);
            let c = new ortLib.Tensor("float32", new Float32Array(Z), [1, 1, Z]);
            // BEAM decode (width B) with length-normalised scoring. The char-level greedy decoder runs away into
            // tail repetition on ~19% of sentences (کن → konaket konaket…) because once it enters a loop it never
            // scores EOS highest. Beam keeps the EOS-terminating hypothesis alive alongside the looping one and
            // (length-normalised) usually prefers it — without the collateral damage a hard n-gram block does to
            // legit repeats. Ported from the word-level vowelRestorer beam.
            const B = 5;
            const zero = () => new ortLib.Tensor("float32", new Float32Array(Z), [1, 1, Z]);
            interface Beam { toks: number[]; lp: number; h: OrtTensor; c: OrtTensor; done: boolean }
            const score = (b: Beam): number => b.lp / Math.max(b.toks.length, 1);
            let beams: Beam[] = [{ toks: [meta.bos], lp: 0, h: zero(), c: zero(), done: false }];
            for (let step = 0; step < T * 3 + 5 && !beams.every((b) => b.done); step++) {
                const cand: Beam[] = [];
                for (const b of beams) {
                    if (b.done) { cand.push(b); continue; }
                    const r = await dec.run({ y: new ortLib.Tensor("int64", BigInt64Array.from([BigInt(b.toks[b.toks.length - 1]!)]), [1, 1]), h: b.h, c: b.c, enc_o: eo, mask });
                    const lo = r.logits!.data as Float32Array;
                    let mx = -Infinity;
                    for (const v of lo) if (v > mx) mx = v;
                    let sum = 0;
                    for (const v of lo) sum += Math.exp(v - mx);
                    const lse = mx + Math.log(sum);
                    const idx = Array.from(lo.keys()).sort((i, j) => lo[j]! - lo[i]!).slice(0, B);
                    for (const nid of idx) {
                        cand.push({ toks: [...b.toks, nid], lp: b.lp + (lo[nid]! - lse), h: r.h_out as unknown as OrtTensor, c: r.c_out as unknown as OrtTensor, done: nid === meta.eos });
                    }
                }
                beams = cand.sort((a, z) => score(z) - score(a)).slice(0, B);
            }
            const best = beams.reduce((a, z) => (score(z) > score(a) ? z : a));
            const outToks = best.toks.slice(1).filter((t) => t !== meta.eos).map((t) => i2t[t] ?? "");
            return stressPerWord(outToks.join(""));
        },
    };
}

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
    InferenceSession: { create(path: string | Uint8Array): Promise<OrtSession> };
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
/** Mark Persian final stress on the last vowel of each space-separated word. */
function stressPerWord(ipa: string): string {
    return ipa.split(" ").map((w) => {
        const vs = [...w.matchAll(VOWEL_G)];
        if (!vs.length) return w;
        const last = vs[vs.length - 1]!.index;
        return w.slice(0, last) + "ˈ" + w.slice(last);
    }).join(" ");
}

/**
 * Build a Persian CONTEXT restorer, or `undefined` if the model / onnxruntime-node is unavailable. The inference
 * code is identical for both trained models — only the weights/vocab differ — so `basename` selects which:
 *   - "fa-context-restorer" (default) — CLASSICAL, aligned-Shahnameh silver, excellent on verse (see above).
 *   - "fa-context-modern"             — MODERN, HomoRich gold (canonical IPA), homograph/ezafe on modern text.
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
        enc = await ortLib.InferenceSession.create(encBytes);
        dec = await ortLib.InferenceSession.create(decBytes);
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
            let y = meta.bos;
            const out: string[] = [];
            for (let step = 0; step < T * 3 + 5; step++) {
                const r = await dec.run({ y: new ortLib.Tensor("int64", BigInt64Array.from([BigInt(y)]), [1, 1]), h, c, enc_o: eo, mask });
                const lo = r.logits!.data as Float32Array;
                let best = 0, bv = -Infinity;
                for (let l = 0; l < lo.length; l++) if (lo[l]! > bv) { bv = lo[l]!; best = l; }
                if (best === meta.eos) break;
                out.push(i2t[best] ?? "");
                y = best;
                h = r.h_out as unknown as OrtTensor;
                c = r.c_out as unknown as OrtTensor;
            }
            return stressPerWord(out.join(""));
        },
    };
}

/**
 * The MODERN Persian context restorer — trained on HomoRich (CC0, 528k modern homograph-rich sentences), targeting
 * our canonical IPA directly (gheyn-conditioned to the fa q/ɣ split). Held-out modern eval: 83.2% per-word. Unlike
 * the classical restorer above, this one is trained on modern prose, so it does NOT hallucinate on everyday text —
 * it is the general-purpose sentence-level path. `undefined` (no-op) if the model / onnxruntime-node is absent.
 */
export function createFaModernContextRestorer(): Promise<FaContextRestorer | undefined> {
    return createFaContextRestorer("fa-context-modern");
}

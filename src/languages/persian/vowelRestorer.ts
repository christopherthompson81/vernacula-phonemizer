/**
 * Persian OOV short-vowel restorer — a char-level SEQ2SEQ (BiLSTM encoder + attention decoder) that maps a bare
 * Persian abjad word directly to IPA, run via ONNX Runtime. This is the NEURAL GENERALISATION tier: it fills the
 * OOV words the exact-match coverage lexicon (harakatLexicon.ts) misses; a lexicon-covered word should be served
 * by the authoritative sync lexicon path instead (precedence lexicon → neural → default).
 *
 * It targets IPA DIRECTLY, not harakat — the harakat intermediate can't express ezafe / final ه / و .
 * Two int8 graphs (encoder + decoder-step) run autoregressively; the output is
 * post-normalised from the training set's classical/Dari convention to Iranian (short i→e, u→o, final ه→e).
 *
 * `onnxruntime-node` is an OPTIONAL dependency, imported lazily; if it — or the .onnx models — are absent,
 * createFaVowelRestorer() resolves to `undefined` and callers fall back to the lexicon+default sync path (no throw).
 * See src/languages/persian/fa-vowel-restorer.PROVENANCE.md and tools/persian/export_s2s_onnx.py.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadOrt, type OrtLike, type OrtSession, type OrtTensor } from "../../core/onnx.ts";

interface Meta {
    src: Record<string, number>;
    tgt: Record<string, number>;
    H: number;
    bos: number;
    eos: number;
    unk: number;
}

export interface FaVowelRestorer {
    /** A bare Persian abjad word → restored Iranian IPA (no stress mark). */
    restore(word: string): Promise<string>;
}

const VOWEL_G = /[aeiouɒæ]ː?/gu;
/** classical/Dari (the wikipron training convention) → Iranian: short i→e, u→o (long iː/uː kept); final ه → [e];
 *  then Persian FINAL stress (mark the last vowel nucleus) so the neural output matches the sync g2p convention. */
function toIranian(ipa: string, word: string): string {
    let s = ipa.replace(/i(?!ː)/gu, "e").replace(/u(?!ː)/gu, "o");
    if (/ه$/u.test(word)) s = s.replace(/a$/u, "e");
    const vs = [...s.matchAll(VOWEL_G)];
    if (vs.length) {
        const last = vs[vs.length - 1]!.index;
        s = s.slice(0, last) + "ˈ" + s.slice(last);
    }
    return s;
}

/** Build the Persian OOV vowel restorer, or `undefined` if the model / onnxruntime-node is unavailable. */
export async function createFaVowelRestorer(): Promise<FaVowelRestorer | undefined> {
    const dir = dirname(fileURLToPath(import.meta.url));
    let meta: Meta, encBytes: Uint8Array, decBytes: Uint8Array;
    try {
        meta = JSON.parse(readFileSync(join(dir, "fa-vowel-restorer.meta.json"), "utf8")) as Meta;
        encBytes = readFileSync(join(dir, "fa-vowel-restorer.enc.onnx"));
        decBytes = readFileSync(join(dir, "fa-vowel-restorer.dec.onnx"));
    } catch {
        return undefined; // model or sidecar absent
    }
    let ortLib: OrtLike, enc: OrtSession, dec: OrtSession;
    try {
        ortLib = await loadOrt("Persian neural restoration");
        enc = await ortLib.InferenceSession.create(encBytes);
        dec = await ortLib.InferenceSession.create(decBytes);
    } catch {
        return undefined; // onnxruntime-node absent or a session failed → sync fallback
    }
    const i2t: Record<number, string> = {};
    for (const [k, v] of Object.entries(meta.tgt)) i2t[v] = k;
    const Z = 2 * meta.H;

    return {
        async restore(word: string): Promise<string> {
            const B = 5; // beam width (+~1.5pp over greedy on the held-out)
            const ids = BigInt64Array.from([...word].map((c) => BigInt(meta.src[c] ?? meta.unk)));
            const T = ids.length;
            if (T === 0) return "";
            const eo = await enc.run({ tokens: new ortLib.Tensor("int64", ids, [1, T]) });
            const enc_o = eo.enc_o as unknown;
            const mask = new ortLib.Tensor("bool", Uint8Array.from(new Array(T).fill(1)), [1, T]);
            const zero = () => new ortLib.Tensor("float32", new Float32Array(Z), [1, 1, Z]);
            interface Beam { toks: number[]; lp: number; h: OrtTensor; c: OrtTensor; done: boolean }
            const score = (b: Beam): number => b.lp / Math.max(b.toks.length, 1); // length-normalised
            let beams: Beam[] = [{ toks: [meta.bos], lp: 0, h: zero(), c: zero(), done: false }];
            for (let step = 0; step < 40 && !beams.every((b) => b.done); step++) {
                const cand: Beam[] = [];
                for (const b of beams) {
                    if (b.done) { cand.push(b); continue; }
                    const r = await dec.run({
                        y: new ortLib.Tensor("int64", BigInt64Array.from([BigInt(b.toks[b.toks.length - 1]!)]), [1, 1]),
                        h: b.h, c: b.c, enc_o, mask,
                    });
                    const lo = r.logits!.data as Float32Array;
                    let mx = -Infinity;
                    for (const v of lo) if (v > mx) mx = v;
                    let sum = 0;
                    for (const v of lo) sum += Math.exp(v - mx);
                    const lse = mx + Math.log(sum); // log-sum-exp → log-softmax
                    const idx = Array.from(lo.keys()).sort((i, j) => lo[j]! - lo[i]!).slice(0, B);
                    for (const nid of idx) {
                        cand.push({ toks: [...b.toks, nid], lp: b.lp + (lo[nid]! - lse), h: r.h_out as unknown as OrtTensor, c: r.c_out as unknown as OrtTensor, done: nid === meta.eos });
                    }
                }
                beams = cand.sort((a, z) => score(z) - score(a)).slice(0, B);
            }
            const best = beams.reduce((a, z) => (score(z) > score(a) ? z : a));
            const out = best.toks.slice(1).filter((t) => t !== meta.eos).map((t) => i2t[t] ?? "");
            return toIranian(out.join(""), word);
        },
    };
}

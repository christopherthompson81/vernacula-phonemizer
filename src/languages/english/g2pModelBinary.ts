/**
 * The binary form of the English OOV G2P model (`g2p-model.bin`), read by all three engines.
 *
 * The model is a joint n-gram over `letter:phones` tokens. As JSON it was 3.8 MB of string keys and pairs, but it
 * holds only ~640 distinct tokens: every context is up to four of them and every candidate is one plus a count. So
 * it is stored as integers — a token table, then each context's order, token ids and total, then the candidates in
 * compressed rows. The engines index contexts by the ids, and the decoder never builds a context string.
 *
 * Layout, little-endian, version 1:
 *
 *     "VG2P"  u32 version
 *     u32 order  f64 alpha  f64 evp  i32 evpOrder  i32 minCount
 *     strings chunkLetters, then per letter: strings chunks           (graphemeChunks, in order)
 *     strings tokens
 *     u32 nContexts
 *     u8[n] ctxOrder   u16[n * 4] ctxTok   u32[n] total   u32[n + 1] rowStart
 *     u16[nnz] cand    u32[nnz] count
 *
 * `strings` is `u32 count, u32[count + 1] byte offsets, UTF-8 bytes`. A context of order `o` holds its tokens in the
 * LAST `o` of its four slots, oldest first; unused slots are `PAD` (0xFFFF). Candidates keep the JSON's order.
 *
 * ⚠ Mirrored by csharp/…/English/G2pModelBinary.cs and rust/…/english/g2p_model_binary.rs; a layout change goes
 * into all three and bumps the version.
 */
import { dataFile } from "../../core/dataPath.ts";
import { readData } from "../../core/dataSource.ts";
import { PAD, type EnglishG2pModel, type PackedG2pModel } from "./englishG2p.ts";

export { PAD, type PackedG2pModel };

const MAGIC = "VG2P";
const VERSION = 1;
const START = "^";


/**
 * A context string back into its tokens. The JSON joins tokens with " ", and a token's chunk may itself hold spaces
 * (`n:AH0 N`); every token starts `<letter>:` (or is the start token `^`) and no phone has `:` second, so a piece
 * without one continues the token before it. Same rule as Rust's `split_context`.
 */
function splitContext(ctx: string): string[] {
    const toks: string[] = [];
    if (ctx === "") return toks;
    for (const piece of ctx.split(" ")) {
        const starts = piece === START || piece[1] === ":";
        if (!starts && toks.length > 0) toks[toks.length - 1] += ` ${piece}`;
        else toks.push(piece);
    }
    return toks;
}

function intIn(x: number, lo: number, hi: number, what: string): number {
    if (!Number.isInteger(x) || x < lo || x > hi)
        throw new Error(`g2p-model: ${what} ${x} is not an integer in [${lo}, ${hi}]`);
    return x;
}

/** The trainer's JSON model as integers. Throws on anything the binary cannot hold exactly. */
export function packG2pModel(m: EnglishG2pModel & { minCount?: number }): PackedG2pModel {
    const tokens: string[] = [];
    const ids = new Map<string, number>();
    const id = (t: string): number => {
        let i = ids.get(t);
        if (i === undefined) {
            i = tokens.length;
            if (i >= PAD) throw new Error(`g2p-model: more than ${PAD} distinct tokens`);
            tokens.push(t);
            ids.set(t, i);
        }
        return i;
    };
    const keys = Object.keys(m.ngram);
    const n = keys.length;
    const ctxOrder = new Uint8Array(n);
    const ctxTok = new Uint16Array(n * 4).fill(PAD);
    const total = new Uint32Array(n);
    const rowStart = new Uint32Array(n + 1);
    const cand: number[] = [];
    const count: number[] = [];
    keys.forEach((key, i) => {
        const bar = key.indexOf("|");
        const o = Number(key.slice(0, bar));
        const ctx = key.slice(bar + 1);
        const toks = splitContext(ctx);
        // ⚠ THE SPLIT MUST BE EXACT: re-joined it is the key, and it has as many tokens as the order says.
        if (bar < 0 || !Number.isInteger(o) || o < 0 || o > 4 || toks.length !== o || toks.join(" ") !== ctx)
            throw new Error(`g2p-model: ngram key ${JSON.stringify(key)} is not order|context with that many tokens`);
        ctxOrder[i] = o;
        toks.forEach((t, j) => (ctxTok[i * 4 + 4 - o + j] = id(t)));
        const e = m.ngram[key]!;
        total[i] = intIn(e.t, 0, 2 ** 32 - 1, `total of ${key}`);
        for (const [t, c] of e.c) {
            cand.push(id(t));
            count.push(intIn(c, 0, 2 ** 32 - 1, `count of ${t} in ${key}`));
        }
        rowStart[i + 1] = cand.length;
    });
    return {
        order: intIn(m.order, 0, 5, "order"),
        alpha: m.alpha,
        evp: m.evp,
        evpOrder: intIn(m.evpOrder, -(2 ** 31), 2 ** 31 - 1, "evpOrder"),
        minCount: intIn(m.minCount ?? 0, -(2 ** 31), 2 ** 31 - 1, "minCount"),
        graphemeChunks: m.graphemeChunks,
        tokens,
        ctxOrder,
        ctxTok,
        total,
        rowStart,
        cand: Uint16Array.from(cand),
        count: Uint32Array.from(count),
    };
}

/** The JSON form back, for tools that read the model and for the pack round trip. */
export function unpackG2pModel(p: PackedG2pModel): EnglishG2pModel & { minCount: number } {
    const ngram: EnglishG2pModel["ngram"] = {};
    for (let i = 0; i < p.ctxOrder.length; i++) {
        const o = p.ctxOrder[i]!;
        const toks: string[] = [];
        for (let j = 4 - o; j < 4; j++) toks.push(p.tokens[p.ctxTok[i * 4 + j]!]!);
        const c: [string, number][] = [];
        for (let k = p.rowStart[i]!; k < p.rowStart[i + 1]!; k++) c.push([p.tokens[p.cand[k]!]!, p.count[k]!]);
        ngram[`${o}|${toks.join(" ")}`] = { t: p.total[i]!, c };
    }
    return {
        order: p.order,
        alpha: p.alpha,
        evp: p.evp,
        evpOrder: p.evpOrder,
        minCount: p.minCount,
        graphemeChunks: p.graphemeChunks,
        ngram,
    };
}

export function encodeG2pModel(p: PackedG2pModel): Uint8Array {
    const enc = new TextEncoder();
    const chunks: Uint8Array[] = [];
    const view = (bytes: number, fill: (v: DataView) => void) => {
        const v = new DataView(new ArrayBuffer(bytes));
        fill(v);
        chunks.push(new Uint8Array(v.buffer));
    };
    const u32s = (xs: ArrayLike<number>) => view(xs.length * 4, (v) => {
        for (let i = 0; i < xs.length; i++) v.setUint32(i * 4, xs[i]!, true);
    });
    const u16s = (xs: ArrayLike<number>) => view(xs.length * 2, (v) => {
        for (let i = 0; i < xs.length; i++) v.setUint16(i * 2, xs[i]!, true);
    });
    const strings = (xs: string[]) => {
        const bytes = xs.map((s) => enc.encode(s));
        const offsets = [0];
        for (const b of bytes) offsets.push(offsets[offsets.length - 1]! + b.length);
        u32s([xs.length]);
        u32s(offsets);
        chunks.push(...bytes);
    };
    chunks.push(Uint8Array.from(MAGIC, (c) => c.charCodeAt(0)));
    u32s([VERSION, p.order]);
    view(16, (v) => {
        v.setFloat64(0, p.alpha, true);
        v.setFloat64(8, p.evp, true);
    });
    view(8, (v) => {
        v.setInt32(0, p.evpOrder, true);
        v.setInt32(4, p.minCount, true);
    });
    const letters = Object.keys(p.graphemeChunks);
    strings(letters);
    for (const l of letters) strings(p.graphemeChunks[l]!);
    strings(p.tokens);
    u32s([p.ctxOrder.length]);
    chunks.push(p.ctxOrder);
    u16s(p.ctxTok);
    u32s(p.total);
    u32s(p.rowStart);
    u16s(p.cand);
    u32s(p.count);
    const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let at = 0;
    for (const c of chunks) {
        out.set(c, at);
        at += c.length;
    }
    return out;
}

/** Load `g2p-model.bin` beside the calling module (pass `import.meta.url`). */
export function loadG2pModel(metaUrl: string): PackedG2pModel {
    return decodeG2pModel(readData(dataFile(metaUrl, "g2p-model.bin")));
}

const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

export function decodeG2pModel(bytes: Uint8Array): PackedG2pModel {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const dec = new TextDecoder("utf-8", { fatal: true });
    let at = 0;
    const take = (n: number): Uint8Array => {
        if (at + n > bytes.length) throw new Error("g2p-model.bin: truncated");
        const x = bytes.subarray(at, at + n);
        at += n;
        return x;
    };
    const u32 = () => (take(4), view.getUint32(at - 4, true));
    const i32 = () => (take(4), view.getInt32(at - 4, true));
    const f64 = () => (take(8), view.getFloat64(at - 8, true));
    // ⚠ A COPY, never `.slice()`: on a Node `Buffer` that is a view, and its `.buffer` is the whole pool.
    const copy = (n: number) => new Uint8Array(take(n)).buffer;
    const u32s = (n: number): Uint32Array => {
        if (LITTLE_ENDIAN) return new Uint32Array(copy(n * 4));
        const out = new Uint32Array(n);
        for (let i = 0; i < n; i++) out[i] = u32();
        return out;
    };
    const u16s = (n: number): Uint16Array => {
        if (LITTLE_ENDIAN) return new Uint16Array(copy(n * 2));
        const out = new Uint16Array(n);
        for (let i = 0; i < n; i++) {
            take(2);
            out[i] = view.getUint16(at - 2, true);
        }
        return out;
    };
    const strings = (): string[] => {
        const n = u32();
        const offsets = u32s(n + 1);
        const block = take(offsets[n]!);
        const out = new Array<string>(n);
        for (let i = 0; i < n; i++) out[i] = dec.decode(block.subarray(offsets[i], offsets[i + 1]));
        return out;
    };

    if (String.fromCharCode(...take(4)) !== MAGIC) throw new Error("g2p-model.bin: not a VG2P file");
    const version = u32();
    if (version !== VERSION) throw new Error(`g2p-model.bin: version ${version}, expected ${VERSION}`);
    const order = u32();
    const alpha = f64();
    const evp = f64();
    const evpOrder = i32();
    const minCount = i32();
    const graphemeChunks: Record<string, string[]> = {};
    for (const l of strings()) graphemeChunks[l] = strings();
    const tokens = strings();
    const n = u32();
    const ctxOrder = new Uint8Array(take(n));
    const ctxTok = u16s(n * 4);
    const total = u32s(n);
    const rowStart = u32s(n + 1);
    const nnz = rowStart[n]!;
    const cand = u16s(nnz);
    const count = u32s(nnz);
    if (at !== bytes.length) throw new Error("g2p-model.bin: trailing bytes");
    for (let k = 0; k < nnz; k++) if (cand[k]! >= tokens.length) throw new Error("g2p-model.bin: candidate token out of range");
    for (let i = 0; i < n; i++) {
        const o = ctxOrder[i]!;
        if (o > 4) throw new Error("g2p-model.bin: context order out of range");
        for (let j = 0; j < 4; j++) {
            const t = ctxTok[i * 4 + j]!;
            if (j < 4 - o ? t !== PAD : t >= tokens.length) throw new Error("g2p-model.bin: context token out of range");
        }
    }
    return { order, alpha, evp, evpOrder, minCount, graphemeChunks, tokens, ctxOrder, ctxTok, total, rowStart, cand, count };
}

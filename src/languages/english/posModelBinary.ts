/**
 * The binary form of the POS model (`pos-model.bin`), read by all three engines.
 *
 * The model is a sparse integer matrix (39k features × 49 classes, 200k non-zero weights). As JSON it was
 * 2.9 MB of string-keyed maps, which every engine parsed into one map per feature. Here it is stored, and
 * held in memory, as compressed rows ({@link PackedPosModel}): a load decodes two string blocks and reads
 * three flat arrays.
 *
 * Layout, little-endian, version 1:
 *
 *     "VPOS"  u32 version  i32 scale
 *     strings classes
 *     strings tagdictKeys   u8[n] tagdictClass
 *     strings features      u32[nFeatures + 1] rowStart
 *     u8[nnz] class         i32[nnz] weight
 *
 * `strings` is `u32 count, u32[count + 1] byte offsets, UTF-8 bytes`. Row `f` holds weights
 * `rowStart[f] .. rowStart[f + 1]`, classes ascending (the order `for (idx in w)` visited a JSON row in).
 *
 * ⚠ Mirrored by csharp/…/English/PosModelBinary.cs and rust/…/english/pos_model_binary.rs; a layout
 * change goes into all three and bumps the version.
 */
import { dataFile } from "../../core/dataPath.ts";
import { readData } from "../../core/dataSource.ts";
import type { PackedPosModel, PosModel } from "./posTagger.ts";

const MAGIC = "VPOS";
const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
const VERSION = 1;

function intIn(x: number, lo: number, hi: number, what: string): number {
    if (!Number.isInteger(x) || x < lo || x > hi)
        throw new Error(`pos-model: ${what} ${x} is not an integer in [${lo}, ${hi}]`);
    return x;
}

const I32_MIN = -(2 ** 31);
const I32_MAX = 2 ** 31 - 1;

/** The trainer's JSON model as compressed rows. Throws on anything the binary cannot hold exactly. */
export function packPosModel(model: PosModel): PackedPosModel {
    const nClasses = model.classes.length;
    if (nClasses > 256) throw new Error(`pos-model: ${nClasses} classes do not fit a u8`);
    const tagdict = new Map<string, number>();
    for (const [k, c] of Object.entries(model.tagdict)) tagdict.set(k, intIn(c, 0, nClasses - 1, `tagdict[${k}]`));
    const rows = new Map<string, number>();
    const rowStart = [0];
    const cls: number[] = [];
    const weight: number[] = [];
    for (const [f, row] of Object.entries(model.weights)) {
        rows.set(f, rows.size);
        const idx = Object.keys(row)
            .map((k) => intIn(Number(k), 0, nClasses - 1, `class index "${k}" of ${f}`))
            .sort((a, b) => a - b);
        for (const c of idx) {
            cls.push(c);
            weight.push(intIn(row[String(c)] ?? NaN, I32_MIN, I32_MAX, `weight of ${f}`));
        }
        rowStart.push(cls.length);
    }
    return {
        scale: intIn(model.scale, I32_MIN, I32_MAX, "scale"),
        classes: model.classes,
        tagdict,
        rows,
        rowStart: Uint32Array.from(rowStart),
        cls: Uint8Array.from(cls),
        weight: Int32Array.from(weight),
    };
}

/** The JSON form back, for reading the model (`tools/english/pos_model_pack.mts unpack`). */
export function unpackPosModel(m: PackedPosModel): PosModel {
    const weights: Record<string, Record<string, number>> = {};
    for (const [f, r] of m.rows) {
        const row: Record<string, number> = {};
        for (let k = m.rowStart[r] ?? 0; k < (m.rowStart[r + 1] ?? 0); k++) row[String(m.cls[k])] = m.weight[k] ?? 0;
        weights[f] = row;
    }
    return { scale: m.scale, classes: m.classes, tagdict: Object.fromEntries(m.tagdict), weights };
}

export function encodePosModel(m: PackedPosModel): Uint8Array {
    const enc = new TextEncoder();
    const chunks: Uint8Array[] = [];
    const u32s = (xs: ArrayLike<number>) => {
        const v = new DataView(new ArrayBuffer(xs.length * 4));
        for (let i = 0; i < xs.length; i++) v.setUint32(i * 4, xs[i] ?? 0, true);
        chunks.push(new Uint8Array(v.buffer));
    };
    const i32s = (xs: ArrayLike<number>) => {
        const v = new DataView(new ArrayBuffer(xs.length * 4));
        for (let i = 0; i < xs.length; i++) v.setInt32(i * 4, xs[i] ?? 0, true);
        chunks.push(new Uint8Array(v.buffer));
    };
    const strings = (xs: string[]) => {
        const bytes = xs.map((s) => enc.encode(s));
        const offsets = [0];
        for (const b of bytes) offsets.push((offsets[offsets.length - 1] ?? 0) + b.length);
        u32s([xs.length]);
        u32s(offsets);
        chunks.push(...bytes);
    };
    chunks.push(Uint8Array.from(MAGIC, (c) => c.charCodeAt(0)));
    u32s([VERSION]);
    i32s([m.scale]);
    strings(m.classes);
    strings([...m.tagdict.keys()]);
    chunks.push(Uint8Array.from(m.tagdict.values()));
    // Rows are numbered in insertion order, so the keys in insertion order are the features by row.
    strings([...m.rows.keys()]);
    u32s(m.rowStart);
    chunks.push(m.cls);
    i32s(m.weight);
    const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let at = 0;
    for (const c of chunks) {
        out.set(c, at);
        at += c.length;
    }
    return out;
}

/** Load `pos-model.bin` beside the calling module (pass `import.meta.url`). */
export function loadPosModel(metaUrl: string): PackedPosModel {
    return decodePosModel(readData(dataFile(metaUrl, "pos-model.bin")));
}

export function decodePosModel(bytes: Uint8Array): PackedPosModel {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const dec = new TextDecoder("utf-8", { fatal: true });
    let at = 0;
    const take = (n: number): Uint8Array => {
        if (at + n > bytes.length) throw new Error("pos-model.bin: truncated");
        const x = bytes.subarray(at, at + n);
        at += n;
        return x;
    };
    const u32 = () => {
        take(4);
        return view.getUint32(at - 4, true);
    };
    const i32 = () => {
        take(4);
        return view.getInt32(at - 4, true);
    };
    // Bulk reads: on a little-endian host a typed array over a copy of the bytes IS the decoded array.
    // (A copy, never `.slice()`: on a Node `Buffer` that is a view, and `.buffer` is the whole pool.)
    const u32s = (n: number): Uint32Array => {
        if (LITTLE_ENDIAN) return new Uint32Array(new Uint8Array(take(n * 4)).buffer);
        const out = new Uint32Array(n);
        for (let i = 0; i < n; i++) out[i] = u32();
        return out;
    };
    const i32s = (n: number): Int32Array => {
        if (LITTLE_ENDIAN) return new Int32Array(new Uint8Array(take(n * 4)).buffer);
        const out = new Int32Array(n);
        for (let i = 0; i < n; i++) out[i] = i32();
        return out;
    };
    // One decode per block. The offsets count UTF-8 bytes; walking the block once converts them to UTF-16
    // offsets into the decoded text (a lead byte starts a code point; one of 4 bytes is a surrogate pair).
    const strings = (): string[] => {
        const n = u32();
        const offsets = u32s(n + 1);
        const block = take(offsets[n] ?? 0);
        const text = dec.decode(block);
        const out = new Array<string>(n);
        let byte = 0;
        let unit = 0;
        let from = 0;
        for (let i = 0; i < n; i++) {
            for (const end = offsets[i + 1] ?? 0; byte < end; byte++) {
                const b = block[byte] ?? 0;
                if ((b & 0xc0) !== 0x80) unit += b >= 0xf0 ? 2 : 1;
            }
            out[i] = text.slice(from, unit);
            from = unit;
        }
        return out;
    };

    if (String.fromCharCode(...take(4)) !== MAGIC) throw new Error("pos-model.bin: not a VPOS file");
    const version = u32();
    if (version !== VERSION) throw new Error(`pos-model.bin: version ${version}, expected ${VERSION}`);
    const scale = i32();
    const classes = strings();
    const tagKeys = strings();
    const tagCls = take(tagKeys.length);
    const tagdict = new Map<string, number>();
    tagKeys.forEach((k, i) => tagdict.set(k, tagCls[i] ?? 0));
    const features = strings();
    const rows = new Map<string, number>();
    features.forEach((f, i) => rows.set(f, i));
    const rowStart = u32s(features.length + 1);
    const nnz = rowStart[features.length] ?? 0;
    const cls = new Uint8Array(take(nnz)); // a copy: `Buffer.slice` would be a view of the shared pool
    const weight = i32s(nnz);
    if (at !== bytes.length) throw new Error("pos-model.bin: trailing bytes");
    if (rows.size !== features.length) throw new Error("pos-model.bin: repeated feature");
    return { scale, classes, tagdict, rows, rowStart, cls, weight };
}

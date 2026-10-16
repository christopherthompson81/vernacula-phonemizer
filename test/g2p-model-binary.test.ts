import { describe, expect, it } from "vitest";
import {
    decodeG2pModel,
    encodeG2pModel,
    loadG2pModel,
    packG2pModel,
    unpackG2pModel,
} from "../src/languages/english/g2pModelBinary.ts";
import type { EnglishG2pModel } from "../src/languages/english/englishG2p.ts";

// A synthetic model: made-up contexts and counts in the trainer's shapes. `n:AH0 N` holds a space, so the context
// `2|n:AH0 N t:T` only splits correctly by the `<letter>:` rule.
const SYNTHETIC: EnglishG2pModel & { minCount: number } = {
    order: 5,
    alpha: 0.4,
    evp: 5,
    evpOrder: 3,
    minCount: 3,
    graphemeChunks: { n: ["N", "AH0 N", ""], t: ["T"] },
    ngram: {
        "0|": { t: 922884, c: [["n:N", 10], ["t:T", 7]] },
        "1|^": { t: 50, c: [["n:AH0 N", 5]] },
        "2|n:AH0 N t:T": { t: 3, c: [["t:T", 2], ["n:", 1]] },
        "4|^ ^ ^ ^": { t: 1, c: [] },
    },
};

describe("g2p-model.bin", () => {
    it("round-trips a model exactly, including tokens with spaces and an empty row", () => {
        expect(unpackG2pModel(decodeG2pModel(encodeG2pModel(packG2pModel(SYNTHETIC))))).toStrictEqual(SYNTHETIC);
    });

    it("refuses a context it cannot split exactly, and counts that are not integers", () => {
        expect(() => packG2pModel({ ...SYNTHETIC, ngram: { "2|n:N": { t: 1, c: [] } } })).toThrow(/order\|context/);
        expect(() => packG2pModel({ ...SYNTHETIC, ngram: { "1|n:N": { t: 1.5, c: [] } } })).toThrow(/not an integer/);
        expect(() => packG2pModel({ ...SYNTHETIC, ngram: { "1|n:N": { t: 1, c: [["t:T", -1]] } } })).toThrow(/count/);
    });

    it("rejects a damaged file", () => {
        const bytes = encodeG2pModel(packG2pModel(SYNTHETIC));
        expect(() => decodeG2pModel(bytes.subarray(0, bytes.length - 1))).toThrow(/truncated/);
        expect(() => decodeG2pModel(new Uint8Array([...bytes, 0]))).toThrow(/trailing/);
        const wrongMagic = bytes.slice();
        wrongMagic[0] = 0;
        expect(() => decodeG2pModel(wrongMagic)).toThrow(/VG2P/);
        const nextVersion = bytes.slice();
        nextVersion[4] = 2;
        expect(() => decodeG2pModel(nextVersion)).toThrow(/version 2/);
    });

    it("the shipped model has the trained shape", () => {
        const m = loadG2pModel(new URL("../src/languages/english/english.ts", import.meta.url).href);
        expect(m.order).toBe(5);
        expect(m.ctxOrder.length).toBeGreaterThan(50000);
        expect(m.tokens).toContain("^");
        expect(Object.keys(m.graphemeChunks)).toHaveLength(26);
    });
});

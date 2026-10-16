import { describe, expect, it } from "vitest";
import {
    decodePosModel,
    encodePosModel,
    loadPosModel,
    packPosModel,
    unpackPosModel,
} from "../src/languages/english/posModelBinary.ts";
import type { PosModel } from "../src/languages/english/posTagger.ts";

// A synthetic model: made-up features and weights, the shapes the trainer emits.
const SYNTHETIC: PosModel = {
    scale: 1000,
    classes: ["DT", "NN", "VB"],
    tagdict: { the: 0, "naïve": 1 },
    weights: {
        bias: { "0": 12, "2": -40000 },
        "i word café": { "1": 34605 },
        "i-1 tag+i word -START- x": {},
    },
};

describe("pos-model.bin", () => {
    it("round-trips a model exactly, including non-ASCII keys and an empty row", () => {
        expect(unpackPosModel(decodePosModel(encodePosModel(packPosModel(SYNTHETIC))))).toStrictEqual(SYNTHETIC);
    });

    it("refuses what it cannot represent rather than storing it wrong", () => {
        expect(() => packPosModel({ ...SYNTHETIC, weights: { f: { "0": 1.5 } } })).toThrow(/not an integer/);
        expect(() => packPosModel({ ...SYNTHETIC, weights: { f: { "3": 1 } } })).toThrow(/class index/);
        expect(() => packPosModel({ ...SYNTHETIC, tagdict: { a: 9 } })).toThrow(/tagdict/);
    });

    it("rejects a damaged file", () => {
        const bytes = encodePosModel(packPosModel(SYNTHETIC));
        expect(() => decodePosModel(bytes.subarray(0, bytes.length - 1))).toThrow(/truncated/);
        expect(() => decodePosModel(new Uint8Array([...bytes, 0]))).toThrow(/trailing/);
        const wrongMagic = bytes.slice();
        wrongMagic[0] = 0;
        expect(() => decodePosModel(wrongMagic)).toThrow(/VPOS/);
        const nextVersion = bytes.slice();
        nextVersion[4] = 2;
        expect(() => decodePosModel(nextVersion)).toThrow(/version 2/);
    });

    it("the shipped model has the trained shape", () => {
        const m = loadPosModel(new URL("../src/languages/english/english.ts", import.meta.url).href);
        expect(m.classes).toHaveLength(49);
        expect(m.rows.size).toBeGreaterThan(30000);
        expect(m.rows.has("bias")).toBe(true);
    });
});

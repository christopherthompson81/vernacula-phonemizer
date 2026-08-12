/**
 * HOW `corpus-diff compare` PAIRS ITS TWO SIDES — the instrument every normalization layer's DROP counts
 * come from.
 *
 * ⚠ WHY THESE EXIST. `compare` parsed both artifacts with `.split("\n").filter((l) => l !== "")` and then
 * demanded equal lengths. An artifact line is the reading of the source line at the same position, and the
 * EMPTY STRING is a reading — the engine deleted every letter because the script fell outside its TOKEN
 * class. Filtering it deletes a record from one side, so `ug` (commit 9c7ae09), whose whole point was that
 * two Arabic presentation-form segments stopped reading as the empty string, got
 * `length mismatch: before 426, after 428 — different corpora?` from two artifacts emitted over the same
 * corpus with byte-identical `.src` files. The instrument refused to measure precisely the improvement it
 * exists to measure, and the better a layer is at closing empty readings the likelier that is.
 *
 * The throw was the LUCKY case, and that is what most of these tests are about: one utterance going
 * empty→text while another goes text→empty leaves the counts equal, and the filter then slides the two
 * arrays past each other and reports FABRICATED differences with no error at all. So the pinned properties
 * are (1) an empty reading survives parsing, (2) a before-empty/after-nonempty pair is one CHANGED row and
 * not a crash, (3) rows pair by the source text that produced them, and (4) a row present on one side only
 * is reported, never paired against its neighbour.
 */
import { describe, expect, test } from "vitest";

import { pairRows, readRecords, scan } from "../tools/normalization/corpus-diff.ts";

/** What `emit` writes: one line per utterance, terminated by a newline. */
const artifact = (lines: string[]): string => `${lines.join("\n")}\n`;

describe("readRecords: an artifact line is a record, and the empty string is a reading", () => {
    test("keeps an interior empty reading", () => {
        expect(readRecords(artifact(["a b", "", "c d"]))).toStrictEqual(["a b", "", "c d"]);
    });

    test("drops only the ONE trailing empty produced by the terminating newline", () => {
        expect(readRecords(artifact(["a b", "c d"]))).toHaveLength(2);
        // A final utterance that read as the empty string is a record AND is followed by the terminator.
        expect(readRecords(artifact(["a b", ""]))).toStrictEqual(["a b", ""]);
    });

    test("an artifact with no terminating newline still parses", () => {
        expect(readRecords("a b\nc d")).toStrictEqual(["a b", "c d"]);
    });

    test("the old parse deleted records — this is the count that produced the ug crash", () => {
        const before = artifact(["a", "", "b", "", "c"]);
        expect(before.split("\n").filter((l) => l !== "")).toHaveLength(3);
        expect(readRecords(before)).toHaveLength(5);
    });
});

describe("the case that started this: before-empty, after-nonempty", () => {
    // Stand-ins for the two ug presentation-form segments: the old engine deleted every letter, the new one
    // reads them. Same corpus, same order, same `.src` on both sides.
    const src = ["one", "two", "three", "four"];
    const B = readRecords(artifact(["wan", "", "θriː", ""]));
    const A = readRecords(artifact(["wan", "tuː", "θriː", "fɔː"]));

    test("both sides parse to the same length, so there is nothing to mismatch", () => {
        expect(B).toHaveLength(4);
        expect(A).toHaveLength(4);
    });

    test("the two closed empty readings pair up and count as CHANGED", () => {
        const p = pairRows(B, A, src, src);
        expect(p.by).toBe("identity");
        expect(p.addedOnly).toStrictEqual([]);
        expect(p.removedOnly).toStrictEqual([]);
        const changed = p.pairs.filter(([j, i]) => B[j] !== A[i]);
        expect(changed).toStrictEqual([[1, 1], [3, 3]]);
    });

    test("an empty reading carries no defect class, so the before column is unmoved by keeping it", () => {
        // The reason no other language's recorded counts move: "" matches none of DIGIT/SLOT-GAP/RAWMARK/
        // DROP/THROW. Only the denominator and the CHANGED set can move, and only where an empty exists.
        expect(scan([""], undefined)).toStrictEqual({ DIGIT: 0, "SLOT-GAP": 0, RAWMARK: 0, DROP: 0, THROW: 0 });
    });
});

describe("the silent mis-pairing the filter could produce, which is worse than the crash", () => {
    // One row closes an empty reading while another opens one. Under the old filter both sides had 3 lines,
    // no error was raised, and every row after the first empty was compared against the wrong partner.
    const src = ["alpha", "beta", "gamma", "delta"];
    const B = readRecords(artifact(["a", "", "g", "d"]));
    const A = readRecords(artifact(["a", "b", "g", ""]));

    test("the old parse made two DIFFERENT corpora look like one and mis-paired every later row", () => {
        const oldB = artifact(["a", "", "g", "d"]).split("\n").filter((l) => l !== "");
        const oldA = artifact(["a", "b", "g", ""]).split("\n").filter((l) => l !== "");
        expect(oldB).toHaveLength(oldA.length); // no throw — and yet
        expect(oldB[1]).toBe("g"); // `gamma`'s reading compared against `beta`'s
        expect(oldA[1]).toBe("b");
        // Two "changes" are reported, which is even the right COUNT — and both are fabricated: `beta`'s
        // reading is diffed against `gamma`'s and `gamma`'s against `delta`'s, while the two rows that
        // really changed are invisible. A plausible wrong answer is the worst thing an instrument can give.
        expect(oldA.map((_, i) => i).filter((i) => oldA[i] !== oldB[i])).toStrictEqual([1, 2]);
    });

    test("pairing by record keeps the aligned rows aligned: exactly two changed", () => {
        const p = pairRows(B, A, src, src);
        expect(p.pairs.filter(([j, i]) => B[j] !== A[i])).toStrictEqual([[1, 1], [3, 3]]);
    });
});

describe("pairing by source text, not by position", () => {
    test("a row that moved is still paired with its own before-reading", () => {
        // A corpus reader whose iteration order changed (a Set is insertion-ordered, and insertion order is
        // the file order) would otherwise report every row as changed.
        const SB = ["one", "two", "three"], SA = ["three", "one", "two"];
        const B = ["wan", "tuː", "θriː"], A = ["θriː", "wan", "tuː"];
        const p = pairRows(B, A, SB, SA);
        expect(p.by).toBe("identity");
        expect(p.pairs.filter(([j, i]) => B[j] !== A[i])).toStrictEqual([]);
    });

    test("a corpus row that appeared is reported, not paired against a neighbour", () => {
        const SB = ["one", "three"], SA = ["one", "two", "three"];
        const B = ["wan", "θriː"], A = ["wan", "tuː", "θriː"];
        const p = pairRows(B, A, SB, SA);
        expect(p.addedOnly).toStrictEqual([1]);
        expect(p.removedOnly).toStrictEqual([]);
        expect(p.pairs).toStrictEqual([[0, 0], [1, 2]]);
        expect(p.pairs.filter(([j, i]) => B[j] !== A[i])).toStrictEqual([]);
    });

    test("a corpus row that went away is reported too", () => {
        const SB = ["one", "two", "three"], SA = ["one", "three"];
        const p = pairRows(["wan", "tuː", "θriː"], ["wan", "θriː"], SB, SA);
        expect(p.removedOnly).toStrictEqual([1]);
        expect(p.addedOnly).toStrictEqual([]);
        expect(p.pairs).toStrictEqual([[0, 0], [2, 1]]);
    });
});

describe("when the source text cannot serve as an identity, say so and fall back to position", () => {
    test("no .src alongside an artifact", () => {
        const p = pairRows(["a", "b"], ["a", "c"], undefined, ["x", "y"]);
        expect(p.by).toBe("position");
        expect(p.note).toMatch(/no \.src/u);
        expect(p.pairs).toStrictEqual([[0, 0], [1, 1]]);
    });

    test("a .src out of step with its artifact is not trusted", () => {
        const p = pairRows(["a", "b"], ["a", "c"], ["x"], ["x", "y"]);
        expect(p.by).toBe("position");
        expect(p.note).toMatch(/out of step/u);
    });

    test("a repeated source line is not an identity", () => {
        // Both readers deduplicate into a Set, so this cannot happen today. It must decline rather than pick
        // an arm at random if that ever stops being true.
        const p = pairRows(["a", "b"], ["a", "b"], ["dup", "dup"], ["dup", "dup"]);
        expect(p.by).toBe("position");
        expect(p.note).toMatch(/repeats/u);
    });

    test("positional fallback still reports the overhang instead of throwing", () => {
        const p = pairRows(["a", "b", "c"], ["a", "b"], undefined, undefined);
        expect(p.pairs).toStrictEqual([[0, 0], [1, 1]]);
        expect(p.removedOnly).toStrictEqual([2]);
        expect(p.addedOnly).toStrictEqual([]);
    });
});

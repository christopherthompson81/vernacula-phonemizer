import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";

// #1533: en-IN's and en-GB's per-word accent delta is English phonology. A run read by another language's reader
// (Hindi, Russian, Greek) is that reader's IPA and must reach the output untouched: before, en-IN retroflexed the
// dental t̪ of नमस्ते and both accents stripped Russian palatalisation. The expected tokens are plain `en`'s, so
// no IPA is typed here; the English words around the run must still carry the accent.
const CASES: [text: string, foreign: number[], english: number][] = [
    ["She said नमस्ते to me.", [2], 1],
    ["He wrote Привет, мир here.", [2, 4], 1],
    ["The word θεός appears.", [2], 1],
];

describe("accent variants leave embedded foreign runs as their reader read them (#1533)", () => {
    for (const lang of ["en-IN", "en-GB"])
        for (const [text, foreign, english] of CASES)
            test(`${lang}: ${text}`, () => {
                const base = phonemize(text, "en").split(" ");
                const got = phonemize(text, lang).split(" ");
                expect(got.length).toBe(base.length);
                for (const i of foreign) expect(got[i]).toBe(base[i]);
                if (lang === "en-IN") expect(got[english]).not.toBe(base[english]); // the delta still applies
            });
});

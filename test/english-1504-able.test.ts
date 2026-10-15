/**
 * #1504: an -able/-ible word reads from its DICTIONARY STEM, preferring the stem without ⟨e⟩: `castable` is
 * `cast` + -able, not `caste` + -able. Expectations are built from the dictionary's own rows (the stem's
 * phones plus the AH0 B AH0 L that 655 of its -able rows end in) and from one engine path against the other;
 * no IPA is typed. Inputs are synthetic.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { phonemize, phonemizeAsync } from "../src/index.ts";
import { createEnglishG2p, type EnglishG2pModel } from "../src/languages/english/englishG2p.ts";
import { MANIFEST } from "../src/languages/english/manifest.ts";

const EN = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "languages", "english");
const dict = new Map<string, string[]>();
for (const l of readFileSync(join(EN, "g2p-dict.tsv"), "utf8").split("\n")) {
    const i = l.indexOf("\t");
    if (i > 0) dict.set(l.slice(0, i), l.slice(i + 1).split(" "));
}
const g2p = createEnglishG2p(
    JSON.parse(readFileSync(join(EN, "g2p-model.json"), "utf8")) as EnglishG2pModel,
    dict,
    new Set(readFileSync(join(EN, "g2p-common.txt"), "utf8").split("\n").map((s) => s.trim()).filter(Boolean)),
    (p: string[]) => p.join(" "),
    { ...MANIFEST.g2pClasses, vowels: MANIFEST.arpabet.vowels, letterNameExceptions: MANIFEST.letterNameExceptions },
);
const ABLE = ["AH0", "B", "AH0", "L"];

describe("en #1504: -able/-ible on a dictionary stem", () => {
    // [word, the stem it must be read from]
    const cases: [string, string][] = [
        ["castable", "cast"],      // not `caste`, which is also a dictionary word
        ["pastable", "past"],      // not `paste`
        ["tasteable", "taste"],
        ["spinnable", "spin"],     // a doubled consonant drops one
        ["surfable", "surf"],
        ["lovable", "love"],       // ⟨e⟩ restored only because `lov` is not a word
        ["reliable", "rely"],      // ⟨y⟩ restored
    ];
    for (const [word, stem] of cases)
        test(`${word} = ${stem} + -able`, () => {
            expect(dict.has(stem)).toBe(true);
            const d = g2p.decompose(word);
            expect(d.source).toBe("M");
            expect(d.phones).toEqual([...dict.get(stem)!, ...ABLE]);
        });

    test("the best path agrees with the sync path: the tagger no longer reads caste + -able", async () => {
        for (const w of ["castable", "pastable", "tasteable"])
            for (const lang of ["en", "en-GB"]) expect(await phonemizeAsync(w, lang)).toBe(phonemize(w, lang));
    });
});

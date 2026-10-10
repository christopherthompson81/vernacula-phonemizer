/**
 * Two Japanese defects the Rust port found by reading (#1463), fixed TS-first.
 *
 * 1. っ before う/え/お copied a bare vowel letter instead of the glottal stop: the vowel test looked at one
 *    code unit, and ɯᵝ, e̞, o̞ are two.
 * 2. `pH` was applied with `replaceAll`, which poisons provenance, so every token of its row lost `inputSpan`;
 *    it also matched inside a longer Latin word.
 */
import { describe, expect, test } from "vitest";
import { phonemize, phonemizeTrace } from "../src/index.ts";
import { MANIFEST } from "../src/languages/japanese/manifest.ts";
import { geminateSokuon, kanaToMorae, segmentsToMorae } from "../src/languages/japanese/kana.ts";
import { normalizeJapanese } from "../src/languages/japanese/normalize.ts";

describe("ja sokuon before a vowel-onset mora is a glottal stop", () => {
    test.each(["あ", "い", "う", "え", "お"])("あっ%s", (v) => {
        // The vowel mora as the engine reads it, never hand-typed.
        const vowel = kanaToMorae(v)!;
        expect(kanaToMorae(`あっ${v}`)).toEqual([...kanaToMorae("あ")!, "ʔ", ...vowel]);
        expect(kanaToMorae(`アッ${v}`)).toEqual(kanaToMorae(`あっ${v}`));
    });

    test("the repro and a word-internal case", () => {
        expect(phonemize("あっお", "ja")).toBe("äʔo̞");
        expect(phonemize("うわっうそ", "ja")).toBe("ɯᵝwäʔɯᵝso̞");
        expect(phonemize("あっお", "ja")).not.toContain("oo");
    });

    test("geminateSokuon across a segment boundary leaves ʔ before every vowel", () => {
        for (const v of Object.values(MANIFEST.vowels)) {
            const a = MANIFEST.vowels.a!;
            expect(geminateSokuon([a, "ʔ", v!])).toEqual([a, "ʔ", v]);
        }
        expect(segmentsToMorae(["あっ", "お"])).toEqual(kanaToMorae("あっお"));
        // A consonant onset still geminates.
        expect(segmentsToMorae(["か", "っ", "た"])).toEqual(kanaToMorae("かった"));
        expect(kanaToMorae("かった")![1]).toBe("t");
    });
});

describe("ja mixed-case acronym pH", () => {
    test("keeps every token's inputSpan", () => {
        for (const text of ["pHの値", "水のpHは", "pH7の水"]) {
            const tr = phonemizeTrace(text, "ja");
            expect(tr.tokens.length).toBeGreaterThan(0);
            for (const k of tr.tokens) expect(k.inputSpan, `${text}: ${JSON.stringify(k)}`).toBeDefined();
        }
        const tr = phonemizeTrace("pHの値", "ja");
        expect(text(tr, "pHの値")).toEqual(["pHの", "値"]);
    });

    test("is still read as the initialism", () => {
        expect(normalizeJapanese("pHの値")).toBe("ピーエイチの値");
        expect(phonemize("pHの値", "ja")).toBe(phonemize("ピーエイチの値", "ja"));
    });

    test("does not match inside a longer Latin word", () => {
        for (const w of ["DepHi", "ApH", "pHD", "pHé"]) expect(normalizeJapanese(`${w}は`)).toBe(`${w}は`);
    });
});

function text(tr: ReturnType<typeof phonemizeTrace>, input: string): string[] {
    return tr.tokens.map((k) => input.slice(...k.inputSpan!));
}

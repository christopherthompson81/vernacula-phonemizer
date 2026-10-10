/**
 * Two Japanese defects the Rust port found by reading (#1463), fixed TS-first.
 *
 * 1. っ geminated whatever followed unless a first-code-unit test called it a vowel. So it copied a bare vowel
 *    letter before う/え/お (ɯᵝ, e̞, o̞ are two units), and it geminated ー, ん and a second っ. The rule is
 *    positive now: っ geminates only a consonant+vowel mora, and otherwise it is the glottal stop.
 * 2. `pH` was applied with `replaceAll`, which poisons provenance, so every token of its row lost `inputSpan`.
 *    It also matched inside a longer Latin word.
 *
 * Every IPA expectation is built from the engine's own phones (MANIFEST, kanaToMorae, GLOTTAL), never typed.
 */
import { describe, expect, test } from "vitest";
import { loadTsvMap } from "../src/core/loadTsv.ts";
import { phonemize, phonemizeTrace } from "../src/index.ts";
import { MANIFEST } from "../src/languages/japanese/manifest.ts";
import { GLOTTAL, geminateSokuon, kanaToMorae, segmentsToMorae } from "../src/languages/japanese/kana.ts";
import { normalizeJapanese, WORD_ACRONYM } from "../src/languages/japanese/normalize.ts";

const morae = (w: string): string[] => kanaToMorae(w)!;

describe("ja sokuon geminates only a consonant+vowel mora", () => {
    test.each(["あ", "い", "う", "え", "お"])("あっ%s is a glottal stop", (v) => {
        expect(morae(`あっ${v}`)).toEqual([...morae("あ"), GLOTTAL, ...morae(v)]);
        expect(morae(`アッ${v}`)).toEqual(morae(`あっ${v}`));
    });

    // What follows the glottal stop: the length mark (read off あー), moraic ん, and a second っ's geminate.
    const tail: Record<string, () => string[]> = {
        "ー": () => morae("あー").slice(1),
        "ん": () => morae("ん"),
        "っか": () => morae("っか"),
    };
    test.each(["ー", "ん", "っか"])("あっ%s is a glottal stop, on both paths", (rest) => {
        const want = [...morae("あ"), GLOTTAL, ...tail[rest]!()];
        expect(morae(`あっ${rest}`)).toEqual(want);
        // The shipped path moraises per segment and re-runs geminateSokuon over the join.
        expect(segmentsToMorae([`あっ${rest}`])).toEqual(want);
    });

    test("segment-final っ before a segment-initial っ agrees with the one-word reading", () => {
        expect(segmentsToMorae(["あっ", "っか"])).toEqual(morae("あっっか"));
        expect(segmentsToMorae(["あっ", "お"])).toEqual(morae("あっお"));
    });

    test("a consonant onset still geminates, including a foreign mora's", () => {
        for (const [w, next] of [["かった", "た"], ["あっきゃ", "きゃ"], ["あっうぃ", "うぃ"]] as const) {
            const m = morae(w);
            expect(m.at(-2)).toBe(morae(next)[0]![0]);
            expect(segmentsToMorae([w.slice(0, -next.length), next])).toEqual(m);
        }
    });

    test("end to end: the glottal stop reaches phonemize", () => {
        const { a, o, u } = MANIFEST.vowels;
        expect(phonemize("あっお", "ja")).toBe(morae("あっお").join(""));
        expect(phonemize("あっお", "ja")).toContain(`${a}${GLOTTAL}${o}`);
        expect(phonemize("うわっうそ", "ja")).toContain(`${GLOTTAL}${u}`);
    });

    test("geminateSokuon leaves kanaToMorae's output unchanged (the ja-kana dump inputs, plus っ + pairs)", () => {
        const J = new URL("../src/languages/japanese/japanese.ts", import.meta.url).href;
        const words = new Set<string>();
        for (const v of loadTsvMap(J, "readings.tsv").values()) words.add(v);
        for (const v of loadTsvMap(J, "fallback.tsv").values()) for (const r of v.split("\t")) if (r) words.add(r);
        for (const k of loadTsvMap(J, "pitch-accent.tsv").keys()) if (/^[ぁ-ゖァ-ヺー]+$/u.test(k)) words.add(k);
        const singles: string[] = ["ー", "ｰ", "ッ", "ゝ"];
        for (let c = 0x3041; c <= 0x3096; c++) singles.push(String.fromCodePoint(c));
        for (let c = 0x30a1; c <= 0x30fa; c++) singles.push(String.fromCodePoint(c));
        for (const a of singles) {
            words.add(a);
            for (const b of singles) {
                words.add(a + b);
                words.add(`っ${a}${b}`);
            }
        }
        let checked = 0;
        const bad: string[] = [];
        for (const w of words) {
            const m = kanaToMorae(w);
            if (m === null) continue;
            checked++;
            if (JSON.stringify(geminateSokuon([...m])) !== JSON.stringify(m)) bad.push(w);
        }
        expect(checked).toBeGreaterThan(100_000);
        expect(bad.slice(0, 20)).toEqual([]);
    });
});

describe("ja mixed-case acronym pH", () => {
    const keys = Object.entries(WORD_ACRONYM).filter(([k]) => /[a-z]/u.test(k));

    test("the table has mixed-case keys, and each one is read as its acronym", () => {
        expect(keys.length).toBeGreaterThan(0);
        for (const [k, v] of keys) {
            expect(normalizeJapanese(`${k}の値`)).toBe(`${v}の値`);
            // An adjacent repeat is still the acronym, once per repeat, as the old replaceAll gave.
            expect(normalizeJapanese(`${k}${k}の値`)).toBe(`${v}${v}の値`);
            expect(normalizeJapanese(`${k} ${k}`)).toBe(`${v} ${v}`);
        }
    });

    test("keeps every token's inputSpan", () => {
        for (const text of ["pHの値", "水のpHは", "pH7の水", "pHpHの値"]) {
            const tr = phonemizeTrace(text, "ja");
            expect(tr.tokens.length).toBeGreaterThan(0);
            for (const k of tr.tokens) expect(k.inputSpan, `${text}: ${JSON.stringify(k)}`).toBeDefined();
        }
        const text = "pHの値";
        expect(phonemizeTrace(text, "ja").tokens.map((k) => text.slice(...k.inputSpan!))).toEqual(["pHの", "値"]);
        expect(phonemize(text, "ja")).toBe(phonemize(`${WORD_ACRONYM.pH}の値`, "ja"));
    });

    test("does not match inside a longer Latin word", () => {
        for (const w of ["DepHi", "ApH", "pHD", "pHé", "pHp"]) expect(normalizeJapanese(`${w}は`)).toBe(`${w}は`);
    });
});

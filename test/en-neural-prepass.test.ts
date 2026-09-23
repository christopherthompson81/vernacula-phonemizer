/**
 * THE NEURAL OOV PRE-PASS MUST SEE THE NORMALIZED TEXT (#1452).
 *
 * ⚠ IT SCANNED THE CALLER'S RAW INPUT, so a word the NORMALIZER creates — `τ` → `tau`, `µin` →
 * `microinch`, `5 Ω` → `ohms`, `ξ` → `zye` — was never in it, never reached the tagger, and fell silently
 * to the weaker n-gram path. Those are exactly the normalizer-introduced words that are also OOV, i.e.
 * the ones with no dictionary row to fall back on, and the tagger roughly HALVES the OOV phone-error-rate.
 *
 * ⚠ AND IT WAS INVISIBLE BECAUSE THE TWO PATHS AGREED ON EVERYTHING ELSE: `phonemize` and
 * `phonemizeAsync` returned different IPA for BYTE-IDENTICAL normalized text.
 */
import { describe, expect, it } from "vitest";

import { phonemizeAsync, phonemizeTrace } from "../src/index.ts";

const norm = (t: string): string => (phonemizeTrace(t, "en") as unknown as { normalized: string }).normalized;

describe("the neural pre-pass scans the normalized text (#1452)", () => {
    it.each([
        ["the τ value", "the tau value"],
        ["a 5 µin finish", "a 5 microinches finish"],
        ["set 5 Ω now", "set 5 ohms now"],
        ["the ξ value", "the zye value"],
    ])("%s and %s normalize alike, so they must READ alike", async (a, b) => {
        // ⚠ THE PREMISE FIRST. If these ever stop normalizing to the same string the assertion below
        // becomes vacuous — it would be comparing two different texts and finding them equal by luck.
        expect(norm(a)).toBe(norm(b));
        expect(await phonemizeAsync(a, "en")).toBe(await phonemizeAsync(b, "en"));
    });

    it("⚠ the ordinal fragment of a date is not a word, and is not tagged", async () => {
        // `2026-09-23` normalizes to `… september 23rd`, where a bare letter run matches the `rd`. The
        // resolver never asks for it — the tokenizer reads `23rd` whole — so the tagged entry would be
        // dead, and an ONNX call is the most expensive thing in that loop.
        expect(norm("on 2026-09-23")).toContain("23rd");
        expect(await phonemizeAsync("on 2026-09-23", "en")).toBe(await phonemizeAsync("on september 23rd 20 26", "en"));
    });

    it("⚠ an alphanumeric token still reaches the tagger — the guard is NOT digit-adjacency", async () => {
        // A blanket "not adjacent to a digit" excluded pinyin with a tone number, unit abbreviations and
        // identifiers, where the LETTERS are a real word the tagger reads and the n-gram does not. Six
        // golden rows across five languages regressed on it. These are the shapes that must survive.
        for (const w of ["zhong1", "600Mbit", "35px", "zhi3"]) {
            const ipa = await phonemizeAsync(w, "en");
            expect([w, ipa]).not.toEqual([w, ""]);
        }
        // `zhong1` reads as the syllable, not as a spelled-out fragment.
        expect(await phonemizeAsync("zhong1", "en")).toContain("ʒ");
    });
});

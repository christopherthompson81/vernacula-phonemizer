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

import { createEnglishTagger } from "../src/languages/english/englishTagger.ts";
import { phonemizeAsync, phonemizeTrace } from "../src/index.ts";

const norm = (t: string): string => (phonemizeTrace(t, "en") as unknown as { normalized: string }).normalized;

describe("the neural pre-pass scans the normalized text (#1452)", () => {
    it("⚠ the tagger is PRESENT, or every assertion below is vacuous", async () => {
        // With no model `phonemizeEnNeural` returns the sync path for BOTH spellings of every pair, so the
        // equality assertions all hold for the wrong reason. The premise guards in each test protect
        // against a vacuous INPUT; this one protects against a vacuous ENGINE.
        expect(await createEnglishTagger()).toBeDefined();
    });

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

    // ⚠ THE EXACT TAGGER READING, NOT "NON-EMPTY" AND NOT "CONTAINS ʒ". The first version of this test
    // asserted both of those, and BOTH HOLD FOR THE N-GRAM TOO — restoring the rejected blanket guard left
    // all of it green. It was a test that named the one regression class the goldens caught and did not
    // cover it. These are the tagger's own readings, and the n-gram gives `ʒˈɑːnd͡ʒ`, `mbˈʌt`,
    // `pʰˌiːʲˈɛks`, `ʒˈɪ` instead — the six golden rows across five languages that refused the guard.
    // ⚠ EACH ONE IN CONTEXT, NOT AT THE START OF THE STRING. The guard only looks at the character BEFORE
    // the match, so a token at index 0 is skipped whatever the guard says — two of these four would have
    // stayed green against the rejected blanket rule purely because of their position. Proven by restoring
    // that rule — the real one, `(?<![0-9])…(?![0-9])` in `WORD`, not a weaker left-side-only stand-in —
    // ALL FOUR go red, and all four are green with the fix.
    it.each([
        ["the zhong1", "ðə ʒˈɔːŋ wˈʌn"],                  // pinyin with a tone number
        ["the 600Mbit", "ðə sˈɪks hˈʌndɹəd ˌɛmbˈɪt"],     // a unit abbreviation
        ["the 35px", "ðə θˈɝt̬i fˈaᶦv pʰˈiːks"],           // an identifier
        ["the zhi3", "ðə ʒˈiː θɹˈiː"],
    ])("an alphanumeric token still reaches the tagger: %s", async (w, want) => {
        expect(await phonemizeAsync(w, "en")).toBe(want);
    });
});

/**
 * dutch.jsonc must be where the Dutch vowel letters, prefixes and function words actually live.
 *
 * Before this, the orthographic vowel inventory was written out in THREE places — g2p.ts, morphology.ts and
 * (as the unrelated IPA set) the manifest's `vowelChars` — and two of them had already drifted: morphology.ts
 * lacked the circumflexes. No reading depended on the difference, which is what made it dangerous: the drift
 * was latent, and the next edit to either copy would have decided it silently.
 *
 * These derive their expectations FROM the manifest, so they fail on DECOUPLING (a re-hardcoded literal) and
 * not on the data being wrong.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { MANIFEST } from "../src/languages/dutch/manifest.ts";
import { numberToWords } from "../src/languages/dutch/numbers.ts";

describe("dutch reads its lifted tables", () => {
    test("the vowel-letter inventory is one string, and it is the accented one", () => {
        // Every accent matters: an omitted one DELETES a vowel from the reading.
        for (const ch of "áéíóúàèâêîôûäëïöü") expect(MANIFEST.vowelLetters).toContain(ch);
        // ⚠ Distinct from `vowelChars`, which is IPA — conflating them is the trap this key exists to avoid.
        expect(MANIFEST.vowelLetters).not.toBe(MANIFEST.vowelChars);
    });

    test("the schwa prefixes are a subset of the unstressed ones, and NOT ambiguousPrefixes", () => {
        const { prefixUnstressed, prefixSchwa, ambiguousPrefixes } = MANIFEST.morphology;
        for (const p of prefixSchwa) expect(prefixUnstressed).toContain(p);
        // ver- reduces but is not ambiguous; ont-/her- shift stress but keep their full vowel.
        expect(prefixSchwa).toContain("ver");
        expect(ambiguousPrefixes).not.toContain("ver");
        for (const p of ["ont", "her"]) expect(prefixSchwa).not.toContain(p);
    });

    for (const [word, ipa] of Object.entries(MANIFEST.functionWords)) {
        test(`function word ${word} → ${ipa}`, () => expect(phonemize(word, "nl")).toBe(ipa));
    }

    test("the trema connector is the vowel-final allomorph", () => {
        expect(MANIFEST.numbers.connectorTrema).not.toBe(MANIFEST.numbers.connector);
        // twee/drie are vowel-final and take the trema; een is not and takes the plain connector.
        expect(numberToWords(22)).toContain(MANIFEST.numbers.connectorTrema);
        expect(numberToWords(23)).toContain(MANIFEST.numbers.connectorTrema);
        expect(numberToWords(21)).not.toContain(MANIFEST.numbers.connectorTrema);
        expect(numberToWords(21)).toContain(MANIFEST.numbers.connector);
    });

    test("the decimal word is spoken from the manifest", () => {
        expect(phonemize("3,5", "nl")).toContain(phonemize(MANIFEST.numbers.decimalWord, "nl"));
    });
});

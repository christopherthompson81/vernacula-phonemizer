/**
 * #1569 (tr): stress.tsv rows refreshed against kaikki. A Wiktionary page lists every reading of a spelling, so a
 * possessive's page also carries the predicative and a verbal noun's the negative imperative; the rows now hold the
 * page's first-listed reading. Expectations are 1-based stressed syllables from kaikki's first-listed IPA, never
 * typed IPA. A genuine variant with no inflectional explanation (the adverb artık) keeps its row.
 */
import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/turkish/turkish.ts";

const stressed = (word: string): number => {
    const ipa = phonemizeWord(word).normalize("NFD");
    let n = 0, inV = false;
    for (const ch of ipa.slice(0, ipa.indexOf("ˈ"))) { const v = /[aeiouyɯøœɛɑ]/u.test(ch); if (v && !inV) n++; inV = v; }
    return n + 1;
};

describe("tr #1569: refreshed stress.tsv rows", () => {
    for (const [w, syl] of [["sorun", 2], ["seçim", 2], ["isim", 2], ["adım", 2], ["okuma", 3], ["basın", 2], ["takım", 2], ["öğretmenim", 4]] as const)
        test(`${w} → syllable ${syl}`, () => expect(stressed(w)).toBe(syl));
    test("the adverb artık keeps its initial stress (a genuine variant, kept)", () => expect(stressed("artık")).toBe(1));
});

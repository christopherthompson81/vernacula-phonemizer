/**
 * #1551 (nl): a word that only LOOKS prefixed (nl-not-prefixed.txt, mined from kaikki) keeps its first-syllable stress
 * and full first vowel, while a real prefix still shifts. Structural expectations (where the stress mark sits and
 * whether the first vowel is a schwa), never typed IPA. Inputs are synthetic word lists.
 */
import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/dutch/dutch.ts";

const V = /[aeiouyɑɛɪɔʏəøœ]/u;
/** Is the stress mark before the first vowel, and is that vowel a full one? */
const firstStressedFull = (w: string): boolean => {
    const ipa = phonemizeWord(w);
    const v = V.exec(ipa);
    return v !== null && ipa.indexOf("ˈ") < v.index && v[0] !== "ə";
};

describe("nl #1551: prefix spellings that are not prefixes", () => {
    for (const w of ["tennis", "hertog", "hersenen", "generaal", "verreweg", "tempo", "technisch", "hersenletsel"])
        test(`${w} keeps first-syllable stress`, () => expect(firstStressedFull(w)).toBe(true));
    for (const w of ["vertellen", "bestellen", "gezellig", "verkopen", "geloven"])
        test(`${w} is still prefixed`, () => expect(firstStressedFull(w)).toBe(false));
});

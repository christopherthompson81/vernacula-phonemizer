/**
 * #1551 (tr): the pre-accent rule narrowed to the suffixes its sources list. Each expectation is a 1-based STRESSED
 * SYLLABLE taken from the sources' statement of the rule, not typed IPA:
 *   · negative -mA- is pre-stressing inside a verb form (Özçelik 2014, Phonology 31; Kahnemuyipour & Kornfilt 2006);
 *   · the conditional -sA on a verb stem is NOT (Özçelik 2014; Kornfilt, ZAS Papers; Kabak & Vogel 2001 via
 *     en.wikipedia "Turkish phonology"), while the copular -(y)sA, -DIr, -(y)ken and instrumental -(y)lA are;
 *   · a plain noun, a numeral, a verbal noun and a past-tense verb take the default final stress.
 * Inputs are synthetic word lists.
 */
import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/turkish/turkish.ts";

/** The 1-based syllable the stress mark precedes, counted on IPA vowel nuclei. */
const stressed = (word: string): number => {
    const ipa = phonemizeWord(word).normalize("NFD");
    let n = 0, inV = false;
    for (const ch of ipa.slice(0, ipa.indexOf("ˈ"))) {
        const v = /[aeiouyɯøœɛɑ]/u.test(ch);
        if (v && !inV) n++;
        inV = v;
    }
    return n + 1;
};

describe("tr #1551: pre-accenting suffixes", () => {
    const cases: [string, number, string][] = [
        ["gelmedi", 1, "negative + past"], ["gelmiyor", 1, "negative + progressive"], ["gelmeden", 1, "negative -mAdAn"],
        ["olmayan", 1, "negative participle"], ["olmasa", 1, "negative + conditional"],
        ["olsa", 2, "conditional on a verb stem: final"], ["gelse", 2, "conditional on a verb stem: final"],
        ["hastaysa", 2, "copular -(y)sA"], ["gelirse", 2, "copular -sA after the aorist"], ["varsa", 1, "var + -sA"],
        ["vardır", 1, "var + copular -DIr"], ["yoktur", 1, "yok + copular -DIr"], ["güzeldir", 2, "copular -DIr"],
        ["nedeniyle", 3, "instrumental -(y)lA"], ["gelirken", 2, "-ken after the aorist"], ["evdeyim", 2, "predicative after a locative"],
        ["deniz", 2, "noun: final"], ["dokuz", 2, "numeral: final"], ["yıldız", 2, "noun: final"],
        ["koruma", 3, "verbal noun: final"], ["kele", 2, "noun (TDK: kele 'boğa'): final"], ["geldim", 2, "past + person: final"],
    ];
    for (const [word, syl, why] of cases)
        test(`${word} → syllable ${syl} (${why})`, () => expect(stressed(word)).toBe(syl));
});

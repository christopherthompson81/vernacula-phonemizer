/**
 * #1550: an unstressed prefix shifts the stress onto a stem whose ⟨e⟩ the scanner had already reduced
 * (`vertellen` read vˈɛrtələn). Expectations are relational, built from words the engine already reads right:
 * the prefix's reading is `verkopen` minus `kopen` (and the like), and a fixed word must read as that prefix
 * plus its stem read alone. No IPA is typed. Inputs are synthetic word lists.
 */
import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/dutch/dutch.ts";

const prefixOf = (whole: string, stem: string): string => {
    const w = phonemizeWord(whole), s = phonemizeWord(stem);
    expect(w.endsWith(s)).toBe(true); // the reference pair itself must decompose cleanly
    return w.slice(0, w.length - s.length);
};

describe("nl #1550: the prefix shift reaches a reduced stem ⟨e⟩", () => {
    const ver = prefixOf("verkopen", "kopen"), her = prefixOf("herhalen", "halen");
    const be = prefixOf("bekijken", "kijken"), ge = prefixOf("gekocht", "kocht");
    const cases: [string, string, string][] = [
        ["vertellen", ver, "tellen"],
        ["vergeten", ver, "geten"],
        ["herkennen", her, "kennen"],
        ["bestellen", be, "stellen"],
        ["gezellig", ge, "zellig"],
    ];
    for (const [word, prefix, stem] of cases)
        test(`${word} = prefix + ${stem}`, () => expect(phonemizeWord(word)).toBe(prefix + phonemizeWord(stem)));

    // A ⟨ge⟩/⟨be⟩/⟨te⟩/⟨ver⟩ spelling whose remainder is only an ENDING is a root, and keeps initial stress; so does
    // a word that starts with the longer stressed prefix `tegen`.
    const firstSyllableStressed = (ipa: string): boolean => {
        const v = /[aeiouyɑɛɪɔʏəøœ]/u.exec(ipa);
        return v !== null && ipa.indexOf("ˈ") < v.index;
    };
    for (const w of ["geven", "beter", "tegen", "verder", "tegenstander"])
        test(`${w} keeps its first-syllable stress`, () => expect(firstSyllableStressed(phonemizeWord(w))).toBe(true));
});

import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";

// Two reported misreadings whose cause was the same shape as the spelling one: a word the reader
// GUESSES instead of knowing. docs/investigations/en/en_reported_misreadings_investigation.md.
describe("reported misreadings", () => {
    // `situ` was not a headword at all, so the two entry points guessed differently — the n-gram
    // read sˈɪt͡ʃuː and the BiLSTM sˈiːt̬uː ("see-two"). CMUdict carries the whole rest of the family
    // (`situate` S IH1 CH UW0 EY2 T, `situated`, `situation`, `situational`) with /sɪtʃu/, so the
    // stem was simply missing rather than contested.
    test("in situ", () => {
        expect(phonemize("in situ", "en")).toBe("ɪn sˈɪt͡ʃuː");
        expect(phonemize("in situ", "en-GB")).toBe("ɪn sˈɪt͡ʃuː");
    });

    test("max expands to maximum, lowercase only and never the verb", () => {
        expect(phonemize("max 40 characters", "en")).toBe("mˈæksəməm fˈɔːɹt̬i kʰˈæɹəktɚz");
        expect(phonemize("a max of 40", "en")).toBe("ə mˈæksəməm ʌv fˈɔːɹt̬i");
        expect(phonemize("to the max", "en")).toBe("tʰuː ðə mˈæksəməm");
        // the dot is consumed, so it cannot become a phrase break mid-sentence
        expect(phonemize("max. 40", "en")).toBe("mˈæksəməm fˈɔːɹt̬i");
        expect(phonemize("the max. is 40", "en")).toBe("ðə mˈæksəməm ɪz fˈɔːɹt̬i");
    });

    test("…and the name and the verb are left alone", () => {
        expect(phonemize("Max went home", "en")).toBe("mˈæks wˈɛnt hˈoᶷm");
        expect(phonemize("Max.", "en")).toBe("mˈæks ."); // sentence-final name, dot kept
        expect(phonemize("max out the budget", "en")).toBe("mˈæks ˈaᶷt ðə bˈʌd͡ʒɪt");
        expect(phonemize("max it out", "en")).toBe("mˈæks ɪt ˈaᶷt"); // particle one word away
        expect(phonemize("maxed out", "en")).toBe("mˈækst ˈaᶷt"); // a different token entirely
    });

    // `IR` has a vowel and a legal coda, so the initialism pass's phonotactic gate calls it
    // PRONOUNCEABLE and hands it to the g2p, which invents the word [ˈɪɹ]. The gloss is the fix and
    // the expansion the reporter asked for; it is case-sensitive so the iridium symbol is untouched.
    test("IR reads as infrared, and only in that exact casing", () => {
        expect(phonemize("IR spectroscopy", "en")).toBe("ˌɪnfɹɚˈɛd spɛktɹˈɑːskəpi");
        expect(phonemize("UV and IR light", "en")).toBe("jˈuːvˈiː ənd ˌɪnfɹɚˈɛd lˈaᶦt");
        expect(phonemize("Ir", "en")).toBe("ˈɪɹ"); // iridium's symbol, left alone
    });
});

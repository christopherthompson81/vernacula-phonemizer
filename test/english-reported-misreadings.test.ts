import { describe, expect, test } from "vitest";

import { readdirSync } from "node:fs";

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

// Subscript digits were dropped by every tier, in every language — `CH₄` read as "see-ehch".
// core/markup.ts already documented the hole from one layer up and worked around it for HTML input
// by flattening `<sub>` to ASCII; text that arrives with the subscripts already in it never met that
// flattening. A subscript is a COUNT, not an exponent, so it folds to ASCII and reads as the plain
// cardinal — which is what the already-correct ASCII spelling of each of these did all along.
describe("subscript digits", () => {
    test("a subscript reads as its cardinal, like the ASCII spelling", () => {
        expect(phonemize("CH₄", "en")).toBe("sˈiː ˈeᶦt͡ʃ fˈɔːɹ");
        expect(phonemize("CH₄", "en")).toBe(phonemize("CH4", "en"));
        expect(phonemize("H₂O", "en")).toBe(phonemize("H2O", "en"));
        expect(phonemize("CO₂", "en")).toBe(phonemize("CO2", "en"));
        expect(phonemize("N₂ and CH₄", "en")).toBe("ˈɛn tʰˈuː ənd sˈiː ˈeᶦt͡ʃ fˈɔːɹ");
    });

    // ⚠ EVERY language, not a sample. The first attempt put this in `makeSymbolNormalizer` and in
    // English's own copy of that pass, which reads like full coverage and is not: measured, that
    // reached 151 of 189 and left 38 — ak, bg, fa, he, ka, lt, my, ro, vi and 29 more — still
    // dropping the digit, because they use neither. The fold belongs at `prePass`, which every
    // language passes through before its own tokenizer sees a character; there, the two spellings
    // are the SAME STRING by the time any engine runs, which is why this can assert equality for
    // all of them rather than spot-check a handful.
    test("every language reads a subscript like its ASCII spelling", () => {
        const langs = readdirSync(new URL("../csharp/goldens", import.meta.url))
            .filter((f) => f.endsWith(".tsv"))
            .map((f) => f.slice(0, -4));
        expect(langs.length).toBeGreaterThan(180);
        const differ = langs.filter((l) => phonemize("CH₄", l) !== phonemize("CH4", l));
        expect(differ).toEqual([]);
    });

    // Superscripts keep their own machinery — a subscript is a count, a superscript is a power.
    test("superscripts are untouched", () => {
        expect(phonemize("x²", "en")).toBe("ˈɛks skwˈɛɹd");
    });
});

// A clause-initial coordinator is not in a reduction environment. Reported as `and` sounding like
// "ind" in "…, built September, and tested from November" — the two `and`s in that sentence were
// byte-identical before this, so nothing downstream could have told them apart. Judged by ear on
// synthesized A/B; the unreduced reading was preferred.
describe("a coordinator that resumes after a pause takes its strong form", () => {
    test("a clause-initial and is strong, mid-clause ones are not", () => {
        expect(phonemize("It rained, and it was cold.", "en"))
            .toBe("ɪt ɹˈeᶦnd , ˈænd ɪt wʌz kʰˈoᶷɫd .");
        expect(phonemize("And then we left.", "en")).toBe("ˈænd ðˈɛn wiː lˈɛft ."); // utterance-initial
        expect(phonemize("dogs and cats", "en")).toBe("dˈɑːɡz ənd kʰˈæts");         // mid-clause: reduced
        expect(phonemize("he and I", "en")).toBe("hiː ənd ˈaᶦ");
    });

    // ⚠ COORDINATORS ONLY. Clause-initial function words generally must keep reducing, or every
    // list and every subordinate clause acquires a stressed article.
    test("other clause-initial function words still reduce", () => {
        expect(phonemize("The man arrived, the woman left.", "en"))
            .toBe("ðə mˈæn ɚˈaᶦvd , ðə wˈʊmən lˈɛft .");
    });

    // ⚠ `or` is the obvious parallel and is NOT in the map — extrapolated, then not supported by the
    // A/B (reported as differing only in speaker dynamicism). Pinned so re-adding it is deliberate.
    test("or is left reduced, because nothing measured it", () => {
        expect(phonemize("Coffee, tea, or water.", "en")).toBe("kʰˈɑːfi , tʰˈiː , ɔːɹ wˈɔːt̬ɚ .");
    });

    // ⚠ The strong coordinator must NOT satisfy the clause's primary-stress test, or restoring it
    // silently cancels the tonic guarantee: this clause has no other primary, and the nucleus has to
    // still land on the final word rather than staying at the head.
    test("the tonic guarantee still fires behind a strong coordinator", () => {
        expect(phonemize(", and it was", "en")).toBe("ˈænd ɪt wˈʌz");
    });
});

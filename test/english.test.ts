import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { PosTagger, type PosModel } from "../src/languages/english/posTagger.ts";

// Canonical-IPA goldens for English. Pronunciation from the CMUdict lexicon + n-gram OOV G2P + POS
// heteronyms; sentence prosody = function-word de-accenting + nuclear tonic on the clause-final word.
describe("english canonical IPA", () => {
    test("heteronyms are POS-gated", () => {
        expect(phonemize("I read a book", "en")).toBe("aᶦ ɹˈɛd ə bˈʊk"); // past read
        expect(phonemize("please read this", "en")).toBe("plˈiːz ɹˈiːd ðˈɪs"); // present read
        expect(phonemize("they record the sales records", "en")).toBe(
            "ðeᶦ ɹᵻkʰˈɔːɹd ðə sˈeᶦɫz ɹˈɛkɚdz",
        ); // verb vs noun-plural
        expect(phonemize("what is the use", "en")).toBe("wˌʌt ɪz ðə jˈuːs"); // noun use
        expect(phonemize("please use it", "en")).toBe("plˈiːz jˈuːz ɪt"); // verb use
        expect(phonemize("the subject", "en")).toBe("ðə sˈʌbd͡ʒɪkt"); // noun-dominant default
        expect(phonemize("the houses", "en")).toBe("ðə hˈaᶷzəz"); // irregular voiced plural (pinned)
    });

    test("possessives + OOV G2P", () => {
        expect(phonemize("putin's car", "en")).toBe("pʰˈuːt̬ɪnz kʰˈɑːɹ");
        expect(phonemize("doomscroll", "en")).toBe("dˈuːmskɹoᶷɫ"); // OOV → native G2P
    });

    test("numbers (cardinal, decimal, ordinal) become words → lexicon", () => {
        expect(phonemize("42", "en")).toBe("fˈɔːɹt̬i tʰˈuː");
        expect(phonemize("one hundred five", "en")).toBe("wˈʌn hˈʌndɹəd fˈaᶦv");
        expect(phonemize("3.14", "en")).toBe("θɹˈiː pʰɔᶦnt wˈʌn fˈɔːɹ");
        expect(phonemize("1st place", "en")).toBe("fˈɝst plˈeᶦs");
    });

    test("de-accenting + nuclear tonic", () => {
        expect(phonemize("give it to me.", "en")).toBe("ɡˈɪv ɪt tʰuː mˈiː ."); // function words reduced, tonic on me
        expect(phonemize("record this.", "en")).toBe("ɹᵻkʰˈɔːɹd ðˈɪs ."); // clause-final tonic promotes 'this'
        expect(phonemize("use it, record this.", "en")).toBe(
            "jˈuːz ɪt , ɹᵻkʰˈɔːɹd ðˈɪs .",
        ); // continuing clause keeps 'it' unstressed
        expect(phonemize("is it done?", "en")).toBe("ɪz ɪt dˈʌn ?");
    });

    test("wh-pronouns demote to secondary; decimal 'point' de-accents", () => {
        expect(phonemize("which one", "en")).toBe("wˌɪt͡ʃ wˈʌn");
        expect(phonemize("who is there", "en")).toBe("hˌuː ɪz ðˈɛɹ");
        expect(phonemize("how are you", "en")).toBe("hˈaᶷ ˈɑːɹ juː"); // wh-ADVERB keeps citation stress
        expect(phonemize("0.5", "en")).toBe("zˈɪɹoᶷ pʰɔᶦnt fˈaᶦv"); // decimal separator is a de-accented connector
    });
});

// ⚠ FOUND BY LISTENING, not by reading. The wav2vec2 pass over the FLEURS corpus caught the space-grouping
// rule joining numbers that were never one number — a defect no text-vs-text gate can see, because both
// readings are well-formed English. Across en_us the pattern matched twice and BOTH were false merges.
describe("space-grouped numbers are not joined across a boundary that is not one", () => {
    test("a four-digit head is proof the space is not a separator", () => {
        // 2,008,400 is written `2 008 400`, never `2008 400`. The reader said "two thousand and eight …
        // four hundred"; we had read *two million eight thousand four hundred*.
        expect(phonemize("the 2008 400 richest americans", "en")).toContain("θˈaᶷzənd ˈeᶦt fˈɔːɹ hˈʌndɹəd");
        expect(phonemize("the 2008 400 richest americans", "en")).not.toContain("mˈɪɫjən");
    });

    test("a day followed by a year is two numbers, not a grouped one", () => {
        // `july 21 356 bce` had merged to 21356.
        expect(phonemize("destroyed on july 21 356 bce", "en")).not.toContain("θˈaᶷzənd θɹˈiː hˈʌndɹəd");
    });

    test("...but real SI grouping still merges, including multi-group", () => {
        expect(phonemize("a population of 2 008 400 people", "en")).toContain("mˈɪɫjən");
    });
});

// ⚠ ALSO FROM THE AUDIT. `u.s.` stripped to `us`, which is an English WORD, so the initialism pass — gated
// on capitals — could not claim it and the dictionary read it as *ʌs*. The reader said "U-S". `u.k.`
// escaped only because "uk" is not a word, which is why this hid for so long.
describe("a dotted letter run is an initialism whatever its case", () => {
    test("u.s. reads as letter names, not as the word 'us'", () => {
        expect(phonemize("former u.s. speaker of the house", "en")).toContain("jˈuː ˈɛs");
        expect(phonemize("former u.s. speaker of the house", "en")).not.toContain("ɚ ˈʌs ");
    });
    test("and the capitalised form is unchanged", () => {
        expect(phonemize("former U.S. speaker", "en")).toContain("jˈuː ˈɛs");
    });
});

// ⚠ THE TAGDICT IS A BARE `JSON.parse` OBJECT, so it inherits Object.prototype and every prototype member
// name looked up as a WORD. `tagdict["constructor"]` was a function, `cached !== undefined` took the cached
// branch, `classes[fn]` was undefined, and the perceptron's prediction was silently replaced by the "NN"
// fallback — for ⟨constructor⟩ and eleven other names. The C# Dictionary inherits nothing and always
// predicted, so the two engines disagreed. The lookup now tests `typeof cached === "number"`.
describe("POS tagger — a word that is also a prototype member name", () => {
    test("the perceptron is consulted, not the NN fallback", () => {
        const model: PosModel = {
            scale: 1,
            classes: ["JJ", "VB"], // deliberately WITHOUT "NN", so the old fallback is visible
            tagdict: { dog: 0 },
            weights: { bias: { "1": 5 } }, // any un-cached word predicts VB
        };
        const tagger = new PosTagger(model);
        expect(tagger.tag(["dog"])).toEqual(["JJ"]); // a real tagdict hit still short-circuits
        expect(tagger.tag(["cat"])).toEqual(["VB"]); // an ordinary miss predicts
        for (const name of ["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__"])
            expect(tagger.tag([name])).toEqual(["VB"]); // …and so does every prototype member name
    });
});

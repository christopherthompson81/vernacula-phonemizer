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

// A PRINTED TIMESTAMP — `Mon, 02 Jan 2006 15:04:05 -0700` — is the one text where every one of these
// rules is exercised at once, and before them the whole line was misread rather than merely flattened:
// the weekday read as the word *mˈoᶷn*, the month as *d͡ʒˈæn*, the seconds colon became a CLAUSE BREAK
// with a stray "five" after it, and the offset read as *nˈɛɡət̬ɪv sˈɛvən hˈʌndɹəd* — a quantity, where
// the field says seven HOURS.
describe("abbreviated dates, clocks and timezone offsets", () => {
    test("a three-letter month is the month, and the date rules then see it", () => {
        // The ordinal day and the pair-wise year both key on the spelled-out name.
        expect(phonemize("Jan 5, 2011", "en")).toBe("d͡ʒˈænjuːˌɛɹi fˈɪfθ , twˈɛnti ɪlˈɛvən");
        expect(phonemize("5 Jan 2011", "en")).toBe("fˈaᶦv d͡ʒˈænjuːˌɛɹi twˈɛnti ɪlˈɛvən");
        expect(phonemize("Sept. 11 2001", "en")).toContain("sɛptˈɛmbɚ ɪlˈɛvənθ");
    });

    test("…but only beside a digit, so the names that are also months are left alone", () => {
        expect(phonemize("Jan said so", "en")).toContain("d͡ʒˈæn");
        expect(phonemize("Jan said so", "en")).not.toContain("d͡ʒˈænjuːˌɛɹi");
    });

    test("a weekday abbreviation needs a MONTH beside it, not just a number", () => {
        expect(phonemize("Wed. October 8", "en")).toContain("wˈɛnzdi");
        expect(phonemize("Thurs, 9 October 2025", "en")).toContain("θˈɝzdeᶦ");
        // ⚠ `sat` and `wed` are verbs and `sun`/`mon` are nouns, so a bare following digit cannot license
        // the weekday reading: "he sat 5 metres away" is not a Saturday.
        expect(phonemize("he sat 5 metres away", "en")).toContain("sˈæt");
        expect(phonemize("he sat 5 metres away", "en")).not.toContain("sˈæt̬ɚdeᶦ");
        // ⚠ AND ⟨may⟩ IS OUT OF THE GATE ENTIRELY: it is a modal verb, and `wed`/`sat` take a bare date
        // complement, so "they wed May 5" read as "they WEDNESDAY may fifth".
        expect(phonemize("they wed May 5", "en")).not.toContain("wˈɛnzdi");
    });

    test("the seconds field is part of the clock, not a stranded colon", () => {
        expect(phonemize("15:04:05", "en")).toBe("fɪftˈiːn ˈoᶷ fˈɔːɹ ənd fˈaᶦv sˈɛkəndz");
        // `:00` is a fixed-width artifact, not content — nobody reads `08:30:00` with a zero-seconds field.
        expect(phonemize("08:30:00", "en")).toBe("ˈeᶦt θˈɝd̬iː");
        // …and one second is one second.
        expect(phonemize("08:30:01", "en")).toBe("ˈeᶦt θˈɝd̬iː ənd wˈʌn sˈɛkənd");
    });

    test("the meridiem trails the whole clock, seconds included", () => {
        // Folded into the hour-and-minute string it is spoken in the MIDDLE of the time.
        expect(phonemize("8:30:45 pm", "en")).toBe("ˈeᶦt θˈɝd̬iː ənd fˈɔːɹt̬i fˈaᶦv sˈɛkəndz pʰˈiːʲˈɛm");
        // The bare clock is untouched: `o'clock` is still suppressed before a meridiem.
        expect(phonemize("3:00 pm", "en")).toBe(phonemize("3 pm", "en"));
    });

    test("a timezone offset is a displacement in hours, not a bare number", () => {
        expect(phonemize("15:04:05 -0700", "en")).toContain("mˈaᶦnəs sˈɛvən ˈaᶷɚz");
        expect(phonemize("08:30:00 +0530", "en")).toContain("plˈʌs fˈaᶦv ˈaᶷɚz θˈɝd̬iː mˈɪnəts");
        // Zero offset is UTC itself; "plus zero hours" is nobody's reading of it.
        expect(phonemize("logged at 08:30:00 +0000 today", "en")).toContain("jˈuː tʰˈiː sˈiː");
        expect(phonemize("logged at 2026-09-11T08:30:00Z today", "en")).toContain("jˈuː tʰˈiː sˈiː");
    });

    test("the ISO form reaches the date rules through its T separator", () => {
        // ⚠ There is no word boundary between the day and the `T`, so a trailing `\b` declined the whole
        // arm and the date read as four bare numbers with a stray letter tee among them.
        expect(phonemize("2026-09-11T15:04:05-07:00", "en")).toBe(
            "sɛptˈɛmbɚ ɪlˈɛvənθ twˈɛnti twˈɛnti sˈɪks fɪftˈiːn ˈoᶷ fˈɔːɹ ənd fˈaᶦv sˈɛkəndz mˈaᶦnəs sˈɛvən ˈaᶷɚz",
        );
    });

    test("a time RANGE is not an offset, in either spelling", () => {
        // `12:30-14:00` has the exact shape of a colon offset, and `09:00-1200` of a glued compact one.
        // The seconds field is what separates them; a SPACED offset needs none.
        expect(phonemize("the meeting runs 12:30-14:00", "en")).not.toContain("mˈaᶦnəs");
        expect(phonemize("the 09:00-1200 block", "en")).not.toContain("mˈaᶦnəs");
        expect(phonemize("the 10:15-1130 slot", "en")).not.toContain("mˈaᶦnəs");
        expect(phonemize("filed at 12:30 -0700", "en")).toContain("mˈaᶦnəs sˈɛvən ˈaᶷɚz");
    });
});

// ⚠ AN ALL-CAPS PAIR AROUND THE AMPERSAND IS ONE INITIALISM. Once the generic ampersand rule has turned
// the sign into a word the two halves are ordinary tokens and the dictionary answers for each separately —
// so a half that happens to be a recorded token is read as that token, and the reading is wrong without
// anything having leaked or vanished.
describe("an ampersand inside an all-caps run", () => {
    test("both halves are spelled out", () => {
        expect(phonemize("R&D spending", "en")).toContain("ˈɑːɹ ənd dˈiː");
        expect(phonemize("AT&T", "en")).toBe("ˈeᶦ tʰˈiː ənd tʰˈiː");
        expect(phonemize("PB&J", "en")).toBe("pʰˈiː bˈiː ənd d͡ʒˈeᶦ");
    });

    test("a half that is a dictionary token is still spelled, not read as that word", () => {
        // ⚠ THIS IS THE CASE THE RULE EXISTS FOR. ⟨SR⟩ on its own is a recorded abbreviation and the
        // dictionary reads it as the WORD *sˈiːnjɚ*, "senior" — so once the generic arm has spent the
        // ampersand, `SR&O` came out as "senior and oh". Nothing leaked and nothing vanished.
        expect(phonemize("the SR&O series", "en")).toBe("ðə ˈɛs ˈɑːɹ ənd ˈoᶷ sˈɪɹiz");
    });

    test("an uppercase HTML entity is the same construction", () => {
        // `&AMP;` is valid HTML5 and is what uppercased markup carries.
        expect(phonemize("R&AMP;D spending", "en")).toBe(phonemize("R&D spending", "en"));
    });

    test("a spaced conjunction is untouched — contiguity is the discriminator", () => {
        expect(phonemize("College of Arts & Sciences", "en")).toContain("ənd");
        expect(phonemize("College of Arts & Sciences", "en")).not.toContain("ˈeᶦ ˈɑːɹ");
    });

    test("…and a TITLE set in capitals has the same shape, so contiguity alone is not enough", () => {
        // Measured over every glued all-caps pair in the mined corpora — 89 instances, every one an
        // initialism, longest half TWO letters. So: halves of at most 3, and at least one half that could
        // not be read as a word at all.
        for (const title of ["LAW&ORDER reruns", "ROCK&ROLL era", "MOM&POP stores"])
            expect(phonemize(title, "en")).not.toContain("ˈɛɫ ˈeᶦ");
        expect(phonemize("MOM&POP stores", "en")).toContain("mˈɑːm");
        // An all-vowel pair declines too, and costs nothing: a bare vowel letter already reads as its name.
        expect(phonemize("A&E tonight", "en")).toBe(phonemize("A and E tonight", "en"));
    });
});

// ⚠ READABILITY IS NOT CONVENTION, which is the whole reason `acronymLetters` exists. ⟨cr⟩ is a legal
// English onset and ⟨a⟩ a vowel, so the phonotactic fail-safe calls the run perfectly syllabifiable,
// declines it, and the OOV g2p reads it as the invented word *kɹˈæ*. Nothing leaks and nothing vanishes;
// it is simply a word that is not there, which no gate in the tree can see.
describe("a pronounceable initialism that is nonetheless spelled out", () => {
    test("it reads as letter names", () => {
        expect(phonemize("the CRA published a notice", "en")).toContain("sˈiː ˈɑːɹ ˈeᶦ");
        expect(phonemize("the CRA published a notice", "en")).not.toContain("kɹˈæ");
    });
});

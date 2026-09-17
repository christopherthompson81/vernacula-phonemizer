import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { normalizeEnglish } from "../src/languages/english/normalize.ts";
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
        expect(phonemize("the houses", "en")).toBe("ðə hˈaᶷzᵻz"); // irregular voiced plural (pinned)
    });

    test("possessives + OOV G2P", () => {
        expect(phonemize("putin's car", "en")).toBe("pʰˈuːt̬ɪnz kʰˈɑːɹ");
        expect(phonemize("doomscroll", "en")).toBe("dˈuːmskɹˌoᶷɫ"); // OOV → native G2P
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
        expect(phonemize("the 2008 400 richest americans", "en")).toContain("θˈaᶷzn̩d ˈeᶦt fˈɔːɹ hˈʌndɹəd");
        expect(phonemize("the 2008 400 richest americans", "en")).not.toContain("mˈɪɫjn̩");
    });

    test("a day followed by a year is two numbers, not a grouped one", () => {
        // `july 21 356 bce` had merged to 21356.
        expect(phonemize("destroyed on july 21 356 bce", "en")).not.toContain("θˈaᶷzənd θɹˈiː hˈʌndɹəd");
    });

    test("...but real SI grouping still merges, including multi-group", () => {
        expect(phonemize("a population of 2 008 400 people", "en")).toContain("mˈɪɫjn̩");
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
        expect(phonemize("Jan 5, 2011", "en")).toBe("d͡ʒˈænjuːˌɛɹi fˈɪfθ , twˈɛnti ɪlˈɛvn̩");
        expect(phonemize("5 Jan 2011", "en")).toBe("fˈaᶦv d͡ʒˈænjuːˌɛɹi twˈɛnti ɪlˈɛvn̩");
        expect(phonemize("Sept. 11 2001", "en")).toContain("sɛptˈɛmbɚ ɪlˈɛvənθ");
    });

    test("…but only beside a digit, so the names that are also months are left alone", () => {
        expect(phonemize("Jan said so", "en")).toContain("d͡ʒˈæn");
        expect(phonemize("Jan said so", "en")).not.toContain("d͡ʒˈænjuːˌɛɹi");
    });

    test("a weekday abbreviation needs a MONTH beside it, not just a number", () => {
        // ⚠ BOTH WEEKDAYS READ `-dˌeᶦ`, and `Wed.` did not used to. This line asserted `wˈɛnzdi` while the
        // line below it asserted `θˈɝzdˌeᶦ` — the two halves of CMUdict's own split across the weekday set,
        // pinned as if both were intended. misaki gold is unanimous (all 12 `-day` words `dˌA`) and wikipron
        // agrees on the two it carries, so `monday`/`tuesday`/`friday`/`saturday` were corrected too.
        expect(phonemize("Wed. October 8", "en")).toContain("wˈɛnzdˌeᶦ");
        expect(phonemize("Thurs, 9 October 2025", "en")).toContain("θˈɝzdˌeᶦ");
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
        expect(phonemize("08:30:00", "en")).toBe("ˈeᶦt θˈɝd̬i");
        // …and one second is one second.
        expect(phonemize("08:30:01", "en")).toBe("ˈeᶦt θˈɝd̬i ənd wˈʌn sˈɛkənd");
    });

    test("the meridiem trails the whole clock, seconds included", () => {
        // Folded into the hour-and-minute string it is spoken in the MIDDLE of the time.
        expect(phonemize("8:30:45 pm", "en")).toBe("ˈeᶦt θˈɝd̬i ənd fˈɔːɹt̬i fˈaᶦv sˈɛkəndz pʰˌiːʲˈɛm");
        // The bare clock is untouched: `o'clock` is still suppressed before a meridiem.
        expect(phonemize("3:00 pm", "en")).toBe(phonemize("3 pm", "en"));
    });

    test("a timezone offset is a displacement in hours, not a bare number", () => {
        expect(phonemize("15:04:05 -0700", "en")).toContain("mˈaᶦnəs sˈɛvən ˈaᶷɚz");
        expect(phonemize("08:30:00 +0530", "en")).toContain("plˈʌs fˈaᶦv ˈaᶷɚz θˈɝd̬i mˈɪnəts");
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

// ⚠ THE FRACTIONAL PART OF A PRICE NEEDS ITS UNIT NOUN, and the defect is not that the number sounds bare —
// it is that a bare integer has nothing to close it, so IT JOINS THE NEXT CLAUSE. `for $3.14 and the 2nd
// time` read "for three dollars FOURTEEN AND the second time", putting the clause boundary in the wrong
// place. espeak-ng reads the same input as θɹˈiː dˈɑːlɚz ænd fˈɔːɹtiːn sˈɛnts.
describe("money with a fractional part", () => {
    test("the cents are spoken as cents, and the clause boundary lands where it should", () => {
        expect(phonemize("I thought about it for $3.14 and the 2nd time.", "en"))
            .toContain("θɹˈiː dˈɑːlɚz fˌɔːɹtˈiːn sˈɛnts ənd ðə sˈɛkənd");
    });

    test("every currency the normalizer expands, with its own subunit", () => {
        expect(phonemize("£3.14", "en")).toBe("θɹˈiː pʰˈaᶷndz fˌɔːɹtˈiːn pʰˈɛns"); // suppletive plural
        expect(phonemize("€3.14", "en")).toBe("θɹˈiː jˈʊɹˌoᶷz fˌɔːɹtˈiːn sˈɛnts");
        expect(phonemize("$1.01", "en")).toBe("wˈʌn dˈɑːlɚ wˈʌn sˈɛnt"); // both singular
        expect(phonemize("£0.01", "en")).toBe("wˈʌn pʰˈɛni");
    });

    test("an amount under one unit is the fraction alone", () => {
        // "zero dollars ninety nine cents" is nobody's reading of a 99-cent price.
        expect(phonemize("$0.99", "en")).toBe("nˈaᶦnti nˈaᶦn sˈɛnts");
    });

    test("a whole amount keeps its old reading, and grouping still rides along", () => {
        expect(phonemize("$3.00", "en")).toBe("θɹˈiː dˈɑːlɚz");
        expect(phonemize("$1,234.56", "en")).toContain("fˈɪfti sˈɪks sˈɛnts");
    });

    test("two prices do not merge into one", () => {
        // ⚠ THIS IS WHY THE PARTS ARE JUXTAPOSED AND NOT JOINED WITH "and". With the conjunction, the
        // elided whole part of the second amount makes it look like the first one's fraction, and the two
        // readings become byte-identical — the same misplaced boundary this rule exists to prevent.
        expect(phonemize("the app is $1.00 and $0.50 for the add-on", "en"))
            .not.toBe(phonemize("the app is $1.50 for the add-on", "en"));
        expect(phonemize("$1.00 and $0.50", "en")).toContain("dˈɑːlɚ ənd fˈɪfti sˈɛnts");
        expect(phonemize("$1.50", "en")).toBe("wˈʌn dˈɑːlɚ fˈɪfti sˈɛnts");
    });

    test("a third decimal is not cents, and a magnitude word is not a fraction", () => {
        // `$3.499` is a pump price and a 4-decimal FX rate has the same shape; matching the first two
        // digits stranded the rest ON THE UNIT NOUN ("3 dollars 49 cents9").
        expect(normalizeEnglish("$3.499 a gallon")).toBe("3.499 dollars a gallon");
        // `$5.50 million` is five and a half million dollars — the decimal reading is the right one, and
        // this rule consumes the sign before step 1's magnitude arm can ever see it.
        expect(normalizeEnglish("$5.50 million")).toBe("5.50 million dollars");
        expect(normalizeEnglish("$2.30bn")).toBe("2.30 billion dollars"); // the letter guard still holds
    });

    test("⟨¥⟩ declines, because the yen has no fractional unit to name", () => {
        // The sen was demonetised in 1953; a decimal yen amount is read as the decimal it is.
        expect(phonemize("¥3.14", "en")).toBe(phonemize("3.14 yen", "en"));
    });
});

// ⚠ THE `-es` PLURAL AFTER A SIBILANT TAKES THE WEAK VOWEL, and the evidence is a CONTRAST rather than a
// count. Bucketing every referee-aligned slot by WHICH SYMBOL WE WROTE there, the en-US referee writes `ɪ`
// in 70.4% of our ᵻ slots and 7.1% of our word-final ə slots — it discriminates — and this environment sits
// at 80-100% (en-GB corroborates at 94.0% of 133 rows). CMUdict also writes the same suffix two ways
// (`bridges AH0` beside `badges IH0`), so before this the lexicon spelled one morpheme `ə` in 345 words and
// `ɪ` in 733. See docs/investigations/en/en_es_plural_weak_vowel_investigation.md.
describe("the -es plural after a sibilant", () => {
    test("takes the weak vowel, from the lexicon…", () => {
        expect(phonemize("services", "en")).toBe("sˈɝvəsᵻz");
        expect(phonemize("offices", "en")).toBe("ˈɔːfəsᵻz");
        expect(phonemize("chances", "en")).toBe("t͡ʃˈænsᵻz");
        expect(phonemize("bridges", "en")).toBe("bɹˈɪd͡ʒᵻz");
    });

    test("…and from every OOV branch, which is where it silently did not", () => {
        // ⚠ THE MORPH BRANCH WAS THE GAP. `g2p` withheld the word from arpabetToIpa for BOTH the compound
        // and the morph decomposition, so an OOV plural off an in-dict stem kept `ɪ` while a recorded one
        // in the same environment had `ᵻ` — the two-spellings defect, on the path the lexicon cannot cover.
        expect(phonemize("quiches", "en")).toBe("kʰˈiːʃᵻz"); // morph: quiche + es
        expect(phonemize("crevasses", "en")).toBe("kɹəvˈæsᵻz"); // morph: crevasse + s
        expect(phonemize("glorses", "en")).toBe("ɡlˈɔːɹsᵻz"); // n-gram: a nonce, no stem at all
        // ⚠ A COMPOUND STILL WITHHOLDS IT, which is what that guard was for: `subreddit` ends "-it" but is
        // not -it suffixed, and passing the word would re-fire the single-morpheme rules on the split.
        expect(phonemize("subreddit", "en")).toBe("sˈʌbɹɛd̬ɪt");
    });

    test("the possessive is the same morpheme and gets the same vowel", () => {
        // ⚠ A POSSESSIVE NEVER REACHES THE LEXICON WHOLE — the clitic is stripped and the STEM looked up —
        // so `sibilantAllomorph`, not the lexicon, supplies this vowel. It said `ɪ` while `-es` said `ᵻ`.
        expect(phonemize("advance's", "en")).toBe("ədvˈænsᵻz");
        expect(phonemize("Marx's", "en")).toBe("mˈɑːɹksᵻz");
        // The other two allomorphs are untouched.
        expect(phonemize("cat's", "en")).toBe("kʰˈæts");
        expect(phonemize("dog's", "en")).toBe("dˈɔːɡz");
    });

    test("the heteronym table does not shadow the rebuilt lexicon", () => {
        // `houses` is the one -es-shaped override; it kept `ə` while `bases` moved to `ᵻ`.
        expect(phonemize("houses", "en").slice(-2)).toBe(phonemize("bases", "en").slice(-2));
    });

    test("one morpheme, one spelling — CMUdict's AH0/IH0 split no longer shows", () => {
        // `bridges` is AH0 and `badges` IH0 in the source; they used to surface as ə and ɪ.
        expect(phonemize("bridges", "en").slice(-2)).toBe(phonemize("badges", "en").slice(-2));
        expect(phonemize("advances", "en").slice(-2)).toBe(phonemize("abuses", "en").slice(-2));
    });

    test("the Greek /iːz/ plurals are untouched — they are IY, not AH/IH", () => {
        // These need no exclusion in the rule: the base test already refuses anything but IH/AH.
        expect(phonemize("crises", "en")).toBe("kɹˈaᶦsiz");
        expect(phonemize("analyses", "en")).toContain("iːz");
    });

    test("a non-sibilant stem is not this environment", () => {
        expect(phonemize("goes", "en")).toBe("ɡˈoᶷz");
        expect(phonemize("notes", "en")).toBe("nˈoᶷts");
    });
});

// ⚠ THE NOUN IS INITIAL-STRESSED, AND THAT IS MEASURED RATHER THAN PREFERRED. espeak says ɹᵻsˈɜːtʃ and
// Merriam-Webster lists the final-stressed noun FIRST, so the dictionaries do not settle it. The asr-align
// corpus does: across every en_us utterance containing the stem, wav2vec2 heard the full FLEECE prefix —
// 14 of 14, zero reduced — including `it narrows the research` and `cautioned that the research`.
// See docs/investigations/en/en_research_noun_stress_investigation.md.
describe("`research` is a noun/verb stress heteronym", () => {
    test("the POS gate picks the stress", () => {
        expect(phonemize("the research shows", "en")).toBe("ðə ɹˈiːsɚt͡ʃ ʃˈoᶷz"); // noun → initial
        expect(phonemize("new research suggests", "en")).toContain("ɹˈiːsɚt͡ʃ");
        expect(phonemize("they research it", "en")).toBe("ðeᶦ ɹisˈɝt͡ʃ ɪt"); // verb → final
        expect(phonemize("he will research this", "en")).toContain("ɹisˈɝt͡ʃ");
    });

    test("the -es form inherits the gate, and the derived noun already agreed", () => {
        expect(phonemize("he researches it", "en")).toContain("ɹisˈɝt͡ʃᵻz"); // 3sg verb → final
        expect(phonemize("the researches were", "en")).toContain("ɹˈiːsɚt͡ʃᵻz"); // noun plural → initial
        // `researcher`/`researchers` were ALREADY initial-stressed in the lexicon — the internal
        // contradiction that prompted the report, now resolved in the direction the corpus attests.
        expect(phonemize("researchers say", "en")).toContain("ɹˈiːsɚt͡ʃɚz");
    });
});

// ⚠ THE RULE IS THE ENVIRONMENT, NOT THE SUFFIX. CMUdict writes word-final `-ire` as `AY ER0` — correct,
// a syllabic ɚ — and keeps it before a CONSONANT suffix (`desired`, `desires`). Before a VOWEL the ɹ
// resyllabifies as that syllable's onset, and there CMUdict is inconsistent: 6 rows kept `ER0` where 20
// wrote `R`. The difference is a SYLLABLE COUNT, both are real English, so the majority was a reason to
// look rather than to sweep. espeak and the UK referee write BOTH segments (`ɹᵻkwˈaɪɚɹɪŋ`, `faɪəɹɪŋ`)
// for BOTH sets — but the asr-align recordings are 7 of 7 for the three-syllable form, `requiring` four of
// them, and `inquiry` twice more. See docs/investigations/en/en_ing_rhotic_investigation.md.
describe("the -ing rhotic after a PRICE diphthong", () => {
    test("the six join the twenty, on the recordings", () => {
        expect(phonemize("requiring", "en")).toBe("ɹᵻkwˈaᶦɹɪŋ");
        expect(phonemize("inquiring", "en")).toBe("ɪŋkwˈaᶦɹɪŋ");
        expect(phonemize("desiring", "en")).toBe("dᵻzˈaᶦɹɪŋ");
        expect(phonemize("transpiring", "en")).toBe("tɹænspˈaᶦɹɪŋ");
        // ⚠ THE WEAKEST-WARRANT ROW OF THE SIX gets the pin it most needs: `backfiring` has no corpus row
        // and no referee row, and is the lone AY2 member — the one a future sweep could revert unnoticed.
        expect(phonemize("backfiring", "en")).toBe("bˈækfaᶦɹɪŋ");
    });

    test("the twenty are unchanged — the corpus confirms them too", () => {
        expect(phonemize("firing", "en")).toBe("fˈaᶦɹɪŋ");
        expect(phonemize("hiring", "en")).toBe("hˈaᶦɹɪŋ");
        expect(phonemize("acquiring", "en")).toBe("əkwˈaᶦɹɪŋ");
    });

    // ⚠ THE SAME RULE AT THE MORPH JOIN, for words that are in no dictionary (#1295). `morphDecode` pasted
    // a dict stem onto an allomorph without resyllabifying, so every unlisted `-ire` verb reproduced the
    // defect #1289 fixed — on an OPEN class rather than 20 rows. Derived from the dict's own attested
    // pairs: a `-ire` stem with a vowel-initial allomorph resyllabifies 15:0; a plain ER-before-vowel rule
    // would be wrong (`water` + `ing` keeps its ER0, as do 429 other pairs).
    test("an unlisted -ire verb resyllabifies at the morph join too", () => {
        // None of these is in the dict or the lexicon — they reach the n-gram/morph path.
        expect(phonemize("misfiring", "en")).toBe("mɪsfˈaᶦɹɪŋ");
        expect(phonemize("umpiring", "en")).toBe("ˈʌmpaᶦɹɪŋ");
        expect(phonemize("attiring", "en")).toBe("ətʰˈaᶦɹɪŋ");
        // ⚠ AND THE CONSONANT ALLOMORPH MUST NOT MOVE: /z/ is not a vowel, so the ɚ stays a nucleus.
        expect(phonemize("misfires", "en")).toBe("mɪsfˈaᶦɚz");
        // ⚠ NOR MAY A CONSONANT-STEM `-er` WORD BE TOUCHED — the 429-pair majority the rule must not break.
        // ⚠ AND THE CONTROL MUST BE GENUINELY OOV. The first version used `watering`, which is IN the
        // lexicon AND the dict — so it is answered by `knownWord` and never reaches the morph join at all.
        // It passed identically with the `-ire` test deleted, i.e. it guarded nothing. These three are in
        // neither file and do exercise the join.
        expect(phonemize("rechartering", "en")).toBe("ɹˈɛkhɑːɹt̬ɚɪŋ");
        expect(phonemize("decluttering", "en")).toBe("dˈɛklʌt̬ɚɪŋ");
        expect(phonemize("unencumbering", "en")).toBe("ˌʌnɛŋkˈʌmbɚɪŋ");
        // ⚠ AND AN `ER`-INITIAL ALLOMORPH IS NOT EXEMPT: the dict writes `enquirer`/`inquirer`/`admirer`
        // with the resyllabified ɹ, so an unlisted `-irer` must not get a doubled rhotic nucleus.
        expect(phonemize("conspirer", "en")).toBe("kənspˈaᶦɹɚ");
        expect(phonemize("conspirers", "en")).toBe("kənspˈaᶦɹɚz");
    });

    test("the environment is a following VOWEL, so `-ies` joins and a non-verb does not", () => {
        // ⚠ `inquiries` WAS THE SAME DEFECT ONE ROW AWAY, and the review caught it: `ER0` before `IY0`,
        // while its own singular `inquiry` already read `AY1 R IY2`. The corpus decides it directly —
        // `inquiry` ×2, both three-syllable (`ɪ n k w aɪ ɹ i`), neither with a schwa before the ɹ.
        // ⚠ `iː` → `i` HERE IS THE FINAL-`-y` DEMOTION, and it removes a contradiction this very test
        // carried: the dict wrote `inquiry` as `IH2 N K W AY1 R IY2` and `inquiries` as `…R IY0 Z`, so
        // the singular was long and stressed while its own plural was short and unstressed, one line
        // apart. Gold has `ˈɪnkwˌIɹi` — unstressed. They now agree.
        expect(phonemize("inquiry", "en")).toBe("ɪŋkwˈaᶦɹi");
        expect(phonemize("inquiries", "en")).toBe("ɪŋkwˈaᶦɹiz");
        // ⚠ `spiering` IS DELIBERATELY LEFT on the four-syllable shape, not overlooked. It is a surname,
        // not `-ire` + `-ing`, so the morphological warrant above does not reach it; it has no corpus row
        // and no referee row; and CMUdict's PRICE vowel for a Dutch-origin name is itself doubtful. A
        // deliberate non-member, pinned so the decision survives the next sweep.
        expect(phonemize("spiering", "en")).toBe("spˈaᶦɚɪŋ");
    });

    test("the require family keeps its ɚ — there is no -ing syllable to take an onset", () => {
        expect(phonemize("require", "en")).toBe("ɹᵻkwˈaᶦɚ"); // #1279
        expect(phonemize("required", "en")).toBe("ɹᵻkwˈaᶦɚd");
        // ⚠ `rewiring` keeps IY0: productive `re-` (wire again), not the lexicalized prefix of #1279.
        expect(phonemize("rewiring", "en")).toBe("ɹiwˈaᶦɹɪŋ");
    });
});

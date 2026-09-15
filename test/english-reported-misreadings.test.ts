import { describe, expect, test } from "vitest";

import { readdirSync } from "node:fs";

import { phonemize, phonemizeAsync } from "../src/index.ts";

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

// `profile` reported as "pro-fil". CMUdict writes P R OW1 F AY2 L, but the secondary-stress clash
// rule drops a 2° adjacent to the 1°, so the AY reached the output with NO mark — not reduced, just
// unmarked, which the TTS renders as reduced. The A/B preferred the marked reading, and the marked
// reading is what the dictionary already said, so this is a faithfulness fix rather than an override.
describe("a closed final syllable on a true diphthong keeps its secondary stress", () => {
    test("the reported word, and the compounds in its class", () => {
        expect(phonemize("profile", "en")).toBe("pɹˈoᶷfˌaᶦɫ");
        expect(phonemize("textile", "en")).toBe("tʰˈɛkstˌaᶦɫ");
        expect(phonemize("skylines", "en")).toBe("skˈaᶦlˌaᶦnz");
        expect(phonemize("zeitgeist", "en")).toBe("tsˈaᶦtɡˌaᶦst");
    });

    // ⚠ EACH GUARD EXISTS BECAUSE THE VERSION WITHOUT IT WAS MEASURABLY WRONG. Without the true-
    // diphthong restriction, CMUdict's OW2 on an ordinary final -o gets marked and over-articulated.
    // Without the closed-syllable one, an open final syllable does. Both are pinned here.
    test("an ordinary final -o is not marked (OW/EY are not true diphthongs here)", () => {
        expect(phonemize("zorro", "en")).toBe("zˈɔːɹoᶷ");
        expect(phonemize("window", "en")).toBe("wˈɪndoᶷ");
        expect(phonemize("airplane", "en")).toBe("ˈɛɹpleᶦn");
    });

    test("an open final syllable is not marked", () => {
        expect(phonemize("a priori", "en")).toContain("pɹaᶦˈɔːɹaᶦ");
    });

    // The clash rule itself is untouched where the 2° is not final — crocodile keeps the mark it
    // always had (its 2° is not adjacent to the 1°), and compile's 1° is on the second syllable.
    test("the rest of the clash rule is unchanged", () => {
        expect(phonemize("crocodile", "en")).toBe("kɹˈɑːkəd̬ˌaᶦɫ");
        expect(phonemize("compile", "en")).toBe("kəmpˈaᶦɫ");
    });
});

// Three more reports, all of the same shape as `IR`: a token the reader had no claim on.
describe("relational operators, fiscal years, and slashed rate units", () => {
    // ⚠ EVERY Unicode relational was silently DROPPED. `=`/`<`/`>`/`×` were already voiced, which is
    // what hid it. The dangerous two are `≠` and `±`: a dropped `≠` is not a missing word, it is the
    // INVERSE claim, and a dropped `±` turns a tolerance into a wrong number.
    test("the Unicode relationals are read", () => {
        expect(phonemize("Panels lit at ≥30%", "en"))
            .toBe("pʰˈænəɫz lˈɪt æt ɡɹˈeᶦt̬ɚ ðæn ɔːɹ ˈiːkwəɫ tʰuː θˈɝd̬iː pɚsˈɛnt");
        expect(phonemize("a ≠ b", "en")).toBe("ə nɑːt ˈiːkwəɫ tʰuː bˈiː");
        expect(phonemize("a ± b", "en")).toBe("ə plˈʌs ɔːɹ mˈaᶦnəs bˈiː");
        expect(phonemize("x ≤ 5", "en")).toContain("lˈɛs ðæn ɔːɹ ˈiːkwəɫ tʰuː");
        expect(phonemize("a ≈ b", "en")).toContain("əpɹˈɑːksəmətli");
    });

    // The PREFIX position is the one that matters and the one an infix pattern cannot reach: "at ≥30%"
    // has no left operand, and read as "at thirty percent" — the threshold gone, the sentence fluent.
    test("…including with no left operand", () => {
        expect(phonemize("≥30", "en")).toContain("ɡɹˈeᶦt̬ɚ ðæn ɔːɹ ˈiːkwəɫ tʰuː");
    });

    // ⚠ The ASCII `<`/`>` keep their digit gate — they can be markup and these cannot.
    test("the ASCII pair is untouched", () => {
        expect(phonemize("5 > 3", "en")).toBe("fˈaᶦv ɡɹˈeᶦt̬ɚ ðæn θɹˈiː");
        expect(phonemize("a = b", "en")).toBe("ə ˈiːkwəɫz bˈiː");
    });

    // `TY2024` read as the word "tie". The four-digit year is the guard that makes it claimable:
    // bare `TY` is "thank you" in casual writing. "Year" also earns the pair-wise reading for free.
    test("a fiscal year is read as one", () => {
        expect(phonemize("TY2024", "en")).toBe("tʰˈæks jˈɪɹ twˈɛnti twˈɛnti fˈɔːɹ");
        expect(phonemize("TY 2024", "en")).toBe("tʰˈæks jˈɪɹ twˈɛnti twˈɛnti fˈɔːɹ");
    });

    test("…and the shapes that are not one are left alone", () => {
        expect(phonemize("ty2024", "en")).not.toContain("tʰˈæks");   // lowercase: an id, not a year
        expect(phonemize("TY24", "en")).not.toContain("tʰˈæks");     // two digits: not the shape
        expect(phonemize("thanks, TY", "en")).not.toContain("tʰˈæks jˈɪɹ");
    });

    // `BTU/hr/sf` read as *bˈiː tʰˈiː jˈuː ˈeᶦt͡ʃˈɑːɹ sf* — the slashes dropped and `sf` reaching the
    // phoneme stream AS LETTERS. The comma is deliberate: two denominators with nothing between them
    // hear as one.
    test("a slashed rate unit reads, with or without a number", () => {
        expect(phonemize("BTU/hr/sf", "en")).toBe("bˈiː tʰˈiː jˈuː pʰɝ ˈaᶷɚ , pʰɝ skwˈɛɹ fˈʊt");
        expect(phonemize("50 BTU/hr", "en")).toBe("fˈɪfti bˈiː tʰˈiː jˈuː pʰɝ ˈaᶷɚ");
        expect(phonemize("250 BTU", "en")).toBe("tʰˈuː hˈʌndɹəd fˈɪfti bˈiː tʰˈiː jˈuː");
    });

    // ⚠ The bare arm is ordered after the number arm so count agreement survives, and its lookarounds
    // are what keep it out of URLs — `example.com/s/page` contains `m/s`.
    test("the bare arm steals neither the count nor a URL", () => {
        expect(phonemize("50 km/h", "en")).toContain("kəlˈɑːmʌt̬ɚz");   // plural kept
        expect(phonemize("km/h", "en")).toContain("kəlˈɑːmət̬ɚ");       // bare → singular
        expect(phonemize("see example.com/s/page", "en")).not.toContain("sˈɛkənd");
        expect(phonemize("and/or", "en")).toBe("ˈænd ˈɔːɹ");
    });
});

// `thermocouple` reported as "thermo-coople". OOV, so the two entry points guessed — and the async one
// the app uses guessed `kʰˌuːpəɫ`, literally "coople". The PLURAL guessed differently again
// (`kʰˌaᶷpəɫz`, "cow-ples"), which is the tell that neither was a reading of anything.
describe("thermocouple", () => {
    test("both paths, and both numbers, agree with espeak-ng", async () => {
        for (const w of ["thermocouple", "thermocouples"])
            expect(phonemize(w, "en")).toBe(await phonemizeAsync(w, "en"));
        expect(phonemize("thermocouple", "en")).toBe("θˈɝməkʰˌʌpəɫ");
        expect(phonemize("thermocouples", "en")).toBe("θˈɝməkʰˌʌpəɫz");
    });

    // The second vowel is a SCHWA, not `oᶷ` — espeak-ng gives θˈɜːməkˌʌpəl and CMUdict's own
    // `thermostat` is TH ER1 M AH0 S T AE2 T. The OOV g2p was reading the spelling's ⟨o⟩ literally.
    test("the -mo- is reduced, as it is in thermostat", () => {
        expect(phonemize("thermocouple", "en")).toContain("θˈɝmə");
        expect(phonemize("thermostat", "en")).toContain("θˈɝmə");
    });
});

// `CO₂` read as the word "co" plus a number. Same accidental coverage as every other report here:
// `CH₄` is right only because `CH` has no vowel, so the phonotactic gate calls it unpronounceable and
// spells it. `CO`, `SO`, `NO` and `AS` are all pronounceable AND dictionary words, so every test in
// the initialism pass passed them through as the word they spell.
describe("a two-letter caps run glued to digits is a code, not a word", () => {
    test("the chemical formulae that were reading as words", () => {
        expect(phonemize("CO₂", "en")).toBe("sˈiː ˈoᶷ tʰˈuː");
        expect(phonemize("SO₂", "en")).toBe("ˈɛs ˈoᶷ tʰˈuː");
        expect(phonemize("NO₂", "en")).toBe("ˈɛn ˈoᶷ tʰˈuː");
        expect(phonemize("H2SO4", "en")).toBe("ˈeᶦt͡ʃ tʰˈuː ˈɛs ˈoᶷ fˈɔːɹ");
        expect(phonemize("CO₂", "en")).toBe(phonemize("CO2", "en")); // the subscript fold, still holding
    });

    // Not only chemistry — any two-letter code glued to digits had the same problem.
    test("…and the alphanumeric codes", () => {
        expect(phonemize("AS400", "en")).toBe("ˈeᶦ ˈɛs fˈɔːɹ hˈʌndɹəd"); // was "az four hundred"
    });

    // ⚠ TWO LETTERS ONLY. A longer glued run is where the real words live, and this is the case that
    // says so: widening it to any length turns COVID19 into "C O V I D nineteen".
    test("a longer glued run is still a word", () => {
        expect(phonemize("COVID19", "en")).toBe("koᶷvˈiːd nˈaᶦntˈiːn");
    });

    // The cases that already worked, pinned so the new rule is shown not to have disturbed them.
    test("the runs that were already right are unchanged", () => {
        expect(phonemize("CH₄", "en")).toBe("sˈiː ˈeᶦt͡ʃ fˈɔːɹ");
        expect(phonemize("H₂O", "en")).toBe("ˈeᶦt͡ʃ tʰˈuː ˈoᶷ");
        expect(phonemize("NH₃", "en")).toBe("ˈɛn ˈeᶦt͡ʃ θɹˈiː");
        expect(phonemize("MP3", "en")).toBe("ˈɛm pʰˈiː θɹˈiː");
        expect(phonemize("A380", "en")).toBe("ˈeᶦ θɹˈiː hˈʌndɹəd ˈeᶦt̬i");
    });
});

// "the 5–15% methane-in-air flammable range" read as "five fifteen percent" — the en dash dropped
// outright, and with it the only thing marking the two numbers as a span.
describe("a dash between two numbers is a range", () => {
    test("the typographic dashes read as 'to'", () => {
        expect(phonemize("the 5–15% flammable range", "en"))
            .toBe("ðə fˈaᶦv tʰuː fɪftˈiːn pɚsˈɛnt flˈæməbəɫ ɹˈeᶦnd͡ʒ");
        expect(phonemize("pages 5–15", "en")).toBe("pʰˈeᶦd͡ʒᵻz fˈaᶦv tʰuː fɪftˈiːn");
        expect(phonemize("5—15", "en")).toContain("tʰuː");          // em dash
        // Ordered after the year rule, so both halves still read pair-wise AND the range says "to".
        expect(phonemize("2019–2020", "en"))
            .toBe("twˈɛnti nˈaᶦntˈiːn tʰuː twˈɛnti twˈɛnti");
    });

    // ⚠ THE ASCII HYPHEN IS NOT CLAIMABLE, and these are the three reasons why. Each is already
    // something else, and claiming the hyphen would turn all of them into ranges.
    test("the ASCII hyphen is left alone — it is already dates, phones and scores", () => {
        expect(phonemize("2024-01-15", "en")).toContain("d͡ʒˈænjuːˌɛɹi"); // a date
        expect(phonemize("a score of 3-2", "en")).not.toContain("tʰuː tʰˈuː");
        expect(phonemize("call 555-0100", "en")).not.toContain(" tʰuː ");
    });

    // ⚠ A SPACED en dash is a parenthetical break, not a span; and a dash between LETTERS is neither.
    test("the shapes that are not ranges", () => {
        expect(phonemize("5 – 15", "en")).not.toContain("tʰuː");
        expect(phonemize("a–b", "en")).not.toContain("tʰuː");
    });
});

// "Rev. B, 2025-10-21" — a drawing title block — read as "reverend B". `rev` is in the fixed-reading
// abbreviation table, which claims the token unconditionally.
describe("Rev. is a revision before a designator and a reverend before a name", () => {
    test("the designator shapes", () => {
        expect(phonemize("Rev. B, 2025-10-21", "en"))
            .toBe("ɹivˈɪʒən bˈiː , ɑːktˈoᶷbɚ twˈɛnti fˈɝst twˈɛnti twˈɛnti fˈaᶦv");
        // ⚠ AND THE DOT IS CONSUMED, which the table could not: its arm needs a following LETTER, so
        // `Rev. 3` matched nothing and the dot survived into the clause segmenter as a phrase break.
        expect(phonemize("Rev. 3", "en")).toBe("ɹivˈɪʒən θɹˈiː");
    });

    // ⚠ THE NAME SHAPES ARE THE POINT OF THE GUARD. `Rev. J. Smith` is the hard one — a capital
    // followed by a PERIOD is a personal initial, and a naive "capital means designator" test claims it.
    test("the name shapes are untouched", () => {
        expect(phonemize("Rev. Smith", "en")).toBe("ɹˈɛvɚənd smˈɪθ");
        expect(phonemize("Rev. J. Smith", "en")).toBe("ɹˈɛvɚənd d͡ʒˈeᶦ . smˈɪθ");
        expect(phonemize("the Rev. Jesse Jackson", "en")).toBe("ðə ɹˈɛvɚənd d͡ʒˈɛsi d͡ʒˈæksən");
    });

    // ⚠ A two-letter designator is the case that caught the `i` flag: with it, the `[a-z]` in the
    // lookahead matches uppercase too, so a following capital was REJECTED and this fell through to
    // "reverend". The flag is off and the literal is cased by hand.
    test("a multi-character designator still reads as a revision", () => {
        expect(phonemize("Rev. AB", "en")).toContain("ɹivˈɪʒən");
        expect(phonemize("Rev. B1", "en")).toContain("ɹivˈɪʒən");
    });
});

describe("a doubled capital is a code, not a word", () => {
    // Reported against a project code whose last field is `-AA`: it read as one run-together vowel
    // (`ˈɑː`, CMUdict's Hawaiian lava word) instead of two letter names. The class is wider than the
    // one token — a repeated capital is an identifier, a date mask or a size, never a word being used
    // as one — and six of them were read as words before this: AA, EE, MM, OO, UU, YY.
    const say = (s: string): string => phonemize(s, "en");

    test("the reported shape", () => {
        // A hyphenated code: the pronounceable field stays a word, the doubled one becomes letters.
        expect(say("(ABC-AA)")).toBe("ˈeᶦbiːsˌiː ˈeᶦ ˈeᶦ");
        expect(say("AA battery")).toBe("ˈeᶦ ˈeᶦ bˈæt̬ɚi");
    });

    test("every doubled capital that used to read as a word", () => {
        expect(say("the AA thing")).toBe("ðə ˈeᶦ ˈeᶦ θˈɪŋ");
        expect(say("the EE thing")).toBe("ðə ˈiː ˈiː θˈɪŋ");   // ⚠ was ONE letter name for two letters
        expect(say("the MM thing")).toBe("ðə ˈɛm ˈɛm θˈɪŋ");
        expect(say("the OO thing")).toBe("ðə ˈoᶷ ˈoᶷ θˈɪŋ");
        expect(say("the UU thing")).toBe("ðə jˈuː jˈuː θˈɪŋ");
        expect(say("the YY thing")).toBe("ðə wˈaᶦ wˈaᶦ θˈɪŋ");
    });

    // ⚠ CC AND SS ARE DELIBERATELY NOT IN THE LIST. CMUdict records both with their LETTER readings
    // already, as one token with one stress, which is better prosody than spelling them out — the
    // same reason `CD` is left alone. Pinned so a later "complete the set" does not undo it.
    test("the two the dictionary already reads as letters keep its reading", () => {
        expect(say("the CC thing")).toBe("ðə siːsˈiː θˈɪŋ");
        expect(say("the SS thing")).toBe("ðə ˈɛsˈɛs θˈɪŋ");
    });

    test("a date mask reads as letters in every field", () => {
        expect(say("format YYYY-MM-DD here")).toBe("fˈɔːɹmæt wˈaᶦ wˈaᶦ wˈaᶦ wˈaᶦ ˈɛm ˈɛm dˈiː dˈiː hˈɪɹ");
    });

    // The neighbours: a doubled capital must not drag off anything that was already right.
    test("what was already right stays right", () => {
        expect(say("the AAA thing")).toBe("ðə tɹˌɪpəlˈeᶦ θˈɪŋ");   // triple-A, a recorded reading
        expect(say("the BB thing")).toBe("ðə bˈiː bˈiː θˈɪŋ");     // already spelled, unrecorded
        expect(say("an aardvark")).toBe(phonemize("an aardvark", "en")); // lowercase is untouched
    });
});

describe("a space-guarded dash is a parenthetical break", () => {
    const say = (s: string): string => phonemize(s, "en");
    // Reported against a question with a spaced hyphen mid-clause: the two halves ran together with
    // no boundary at all, where a comma in the same slot pauses. All four written forms were dropped.
    const COMMA = "ðə ˈænsɚ , ə lˈɔːŋ wˈʌn , ɚˈaᶦvd";

    test("every space-guarded form reads like the comma it stands in for", () => {
        expect(say("the answer, a long one, arrived")).toBe(COMMA);   // the baseline
        expect(say("the answer - a long one - arrived")).toBe(COMMA); // ASCII hyphen
        expect(say("the answer -- a long one -- arrived")).toBe(COMMA);
        expect(say("the answer – a long one – arrived")).toBe(COMMA); // en dash
        expect(say("the answer — a long one — arrived")).toBe(COMMA); // em dash
    });

    // ⚠ THE OTHER HOUSE STYLE. An unspaced em dash is the standard US form and was dropped just as
    // completely; an unspaced EN dash is a JOINER and must not gain a pause.
    test("an unspaced em dash breaks, an unspaced en dash joins", () => {
        expect(say("the answer—a long one—arrived")).toBe(COMMA);
        expect(say("Bose–Einstein condensate")).toBe("bˈoᶷz ˈaᶦnstaᶦn kʰˈɑːndənsˌeᶦt");
    });

    // ⚠ THE WORD-JOINER IS WHAT THIS MUST NOT TOUCH, and the spaces are the whole disambiguation.
    test("hyphenated compounds are untouched", () => {
        expect(say("a well-known case")).toBe("ə wˈɛɫ nˈoᶷn kʰˈeᶦs");
        expect(say("state-of-the-art design")).toBe("stˈeᶦt ʌv ðə ˈɑːɹt dᵻzˈaᶦn");
        expect(say("re-enter the code")).toBe("ɹˈeᶦ ˈɛntɚ ðə kʰˈoᶷd");
    });

    // ⚠ A LIST MARKER OPENING A LINE HAS NO WORD BEFORE IT, which is why the left guard is a
    // non-space rather than \s — otherwise the newline would satisfy it and every bullet would pause.
    test("a dash opening a line is not a parenthetical break", () => {
        expect(say("first item\n- second item")).not.toContain(",");
    });

    // The range rule owns the digit cases and still does: it runs first and says "to", not a pause.
    test("a numeric span still says the connective", () => {
        expect(say("pages 5–15")).toBe("pʰˈeᶦd͡ʒᵻz fˈaᶦv tʰuː fɪftˈiːn");
        expect(say("the 1990–1995 period")).toContain("tʰuː");
    });

    // ⚠ A DASH WITH A DIGIT ON BOTH SIDES IS A SPAN WRITTEN LOOSE, not a parenthesis. `1418 – 1450`
    // is a date range, and what it reads as today is pinned by two measured tests in
    // english-normalize.test.ts; claiming it here would have changed a measured reading as a side
    // effect of an unrelated report. The digit/word mixes are claimed — those are not spans.
    test("a spaced span between two numbers is left to the range rules", () => {
        expect(say("from 1990 - 1995")).not.toContain(",");
        expect(say("from 1990 - present")).toContain(",");
        expect(say("page - 5 of the report")).toContain(",");
    });
});

describe("a postfix plus is read", () => {
    const say = (s: string): string => phonemize(s, "en");
    // Reported against a chemical-fraction code ending in `+`: the sign vanished. Both existing arms
    // require a DIGIT ON THE RIGHT, so nothing claimed a plus in final position — the same shape the
    // Unicode relationals were fixed for, a pattern binding to an operand it does not have.
    test("the reported shape", () => {
        expect(say("C7+")).toBe("sˈiː sˈɛvən plˈʌs");
        expect(say("the C7+ cut")).toBe("ðə sˈiː sˈɛvən plˈʌs kʰˈʌt");
    });

    test("the rest of the postfix class", () => {
        expect(say("18+")).toContain("plˈʌs");
        expect(say("100+ people")).toContain("plˈʌs");
        expect(say("Na+ ion")).toContain("plˈʌs");
    });

    // ⚠ THE RUN IS MATCHED WHOLE. A per-sign rule reads the first and strands the second, because
    // String.replace scans the ORIGINAL string: after consuming `C+`, the next `+` has no letter
    // before it. "C plus plus" is also the right reading of the language's name.
    test("a run of signs is read once per sign", () => {
        expect(say("C++ code")).toBe("sˈiː plˈʌs plˈʌs kʰˈoᶷd");
    });

    // The infix arm's digit gate misses these too.
    test("between two non-digit operands", () => {
        expect(say("the + sign")).toBe("ðə plˈʌs sˈaᶦn");
        expect(say("a + b")).toContain("plˈʌs");
    });

    test("what already worked is unchanged", () => {
        expect(say("2 + 2")).toBe("tʰˈuː plˈʌs tʰˈuː");
        expect(say("2+2")).toBe("tʰˈuː plˈʌs tʰˈuː");
        expect(say("+5 volts")).toBe("plˈʌs fˈaᶦv vˈoᶷɫts");
        expect(say("5 + 3 = 8")).toBe("fˈaᶦv plˈʌs θɹˈiː ˈiːkwəɫz ˈeᶦt");
    });

    // ⚠ A `+`-MARKED LIST KEEPS ITS BULLETS, which is why the between-words arm takes horizontal
    // space only — with `\s` the newline satisfies the left guard and every marker says "plus".
    test("a list marker is not an operator", () => {
        expect(say("first item\n+ second item")).not.toContain("plˈʌs");
    });
});

import { describe, expect, test } from "vitest";

import { normalizeEnglish } from "../src/languages/english/normalize.ts";
import { phonemize } from "../src/index.ts";

// English text normalization: rewrite non-lexical tokens into speakable words BEFORE the
// tokenizer, so the existing number/ordinal/OOV machinery pronounces them. Asserted mostly at the
// TEXT level (the rewrite is the contract; pronunciation is the number path's own tested concern).
describe("English text normalization", () => {
    test("percent and currency are no longer silently dropped", () => {
        expect(normalizeEnglish("40% of people")).toBe("40 percent of people");
        expect(normalizeEnglish("$5 million")).toBe("5 million dollars");
        expect(normalizeEnglish("$1")).toBe("1 dollar"); // count agreement
        expect(normalizeEnglish("€20")).toBe("20 euros");
    });

    test("times", () => {
        expect(normalizeEnglish("at 3:30 pm")).toBe("at 3 30 pm");
        expect(normalizeEnglish("12:05")).toBe("12 oh 5");
        expect(normalizeEnglish("7:00")).toBe("7 o'clock");
        expect(normalizeEnglish("7:00 am")).toBe("7 am"); // no o'clock before am/pm
    });

    test("dates ordinalize the day", () => {
        expect(normalizeEnglish("february 16")).toBe("february 16th");
        expect(normalizeEnglish("july 8")).toBe("july 8th");
        expect(normalizeEnglish("march 3")).toBe("march 3rd");
        expect(normalizeEnglish("may 21")).toBe("may 21st");
        expect(normalizeEnglish("february 16th")).toBe("february 16th"); // already ordinal → untouched
    });

    test("years read pair-wise in date contexts only", () => {
        expect(normalizeEnglish("in 1998 the")).toBe("in 19 98 the");
        expect(normalizeEnglish("in 1905")).toBe("in 19 oh 5");
        expect(normalizeEnglish("in 1900")).toBe("in 19 hundred");
        expect(normalizeEnglish("in 2007")).toBe("in 2 thousand 7");
        expect(normalizeEnglish("february 16 2011")).toBe("february 16th 20 11");
        expect(normalizeEnglish("2011 people died")).toBe("2011 people died"); // no context → cardinal
        expect(normalizeEnglish("in 1998.5 units")).toBe("in 1998.5 units"); // decimal guard
    });

    /** ⚠ A DETERMINER BETWEEN THE CONTEXT WORD AND THE YEAR used to block the pair-wise reading, so
     *  "in a 1998 book" spoke *one thousand nine hundred ninety-eight* while "in 1998" was correct.
     *  The ASR corpus found it: `hˈʌndɹəd` was among the commonest words in the en_us investigate queue
     *  and the recognizer plainly returns *nineteen ninety-eight*. 12 closer / 0 further, median
     *  0.2593 → 0.1515 against both recognizers.
     *  ⚠ PRE-2010 ONLY, and that is measured rather than stylistic: on 2010-2019 the same loosening
     *  scored 1 closer / 6 further, because readers of a 2010s year often say "two thousand seventeen"
     *  while nobody says "one thousand nine hundred ninety-eight". The tight contexts are unchanged for
     *  every year, so "in 2011" still reads pair-wise. */
    test("a determiner may sit between the context word and a pre-2010 year", () => {
        expect(normalizeEnglish("in a 1998 book")).toBe("in a 19 98 book");
        expect(normalizeEnglish("of the 2009 season")).toBe("of the 2 thousand 9 season");
        expect(normalizeEnglish("since the 1905 report")).toBe("since the 19 oh 5 report");
        expect(normalizeEnglish("after the 2010 earthquake")).toBe("after the 2010 earthquake");
        expect(normalizeEnglish("in a 2011 people survey")).toBe("in a 2011 people survey");
        expect(normalizeEnglish("in 2011")).toBe("in 20 11"); // tight context, unchanged
    });

    /** ⚠ A DASHED PAIR OF 4-DIGIT YEARS IS A DATE RANGE — encyclopedic prose is full of life dates, and
     *  "guru nanak 1469–1539" was read as two cardinals. Both sides take the pair-wise reading and the
     *  dash is left alone rather than spoken as "to", which would assert a word the reader may not say.
     *  ⚠ IT MUST RUN BEFORE THE CONTEXT RULE: with that order reversed, "from 1918-1939" had its left
     *  year consumed by the context arm and came out half-converted as "from 19 18-1939". */
    test("a dashed pair of years is a range, and the left one is not eaten first", () => {
        expect(normalizeEnglish("guru nanak 1469–1539")).toBe("guru nanak 14 69–15 39");
        expect(normalizeEnglish("from 1918-1939 the war")).toBe("from 19 18-19 39 the war");
        expect(normalizeEnglish("the 1418 - 1450 period")).toBe("the 14 18 - 14 50 period");
        // ⚠ 2010s RANGES CONVERT TOO, matching the tight contexts ("in 2011" → "20 11"). Restricting the
        // range arm to pre-2010 while the context arm still fired on 2010s years reintroduced the exact
        // half-conversion the ordering above exists to prevent: "from 2011-2015" → "from 20 11-2015".
        expect(normalizeEnglish("from 2011-2015 he served")).toBe("from 20 11-20 15 he served");
        expect(normalizeEnglish("from 2009-2015")).toBe("from 2 thousand 9-20 15");
    });

    /** ⚠ A DASHED PAIR OF 4-DIGIT NUMBERS IS NOT ALWAYS A DATE, and the range rule shipped without a gate
     *  in review: `pp. 1234-1256` read as "12 34-12 56" and `room 1200-1300` as "12 hundred-13 hundred".
     *  Two guards, one specific and one general — a reference/quantity cue before, the context arm's unit
     *  list after, and the observation that A DATE RANGE ASCENDS, which rules out phone fragments and
     *  reversed ID ranges as a class rather than one cue at a time. */
    test("a dashed pair that is not a date keeps its cardinal reading", () => {
        expect(normalizeEnglish("see pp. 1234-1256 for details")).toBe("see pp. 1234-1256 for details");
        expect(normalizeEnglish("room 1200-1300")).toBe("room 1200-1300");
        expect(normalizeEnglish("pages 1100-1200")).toBe("pages 1100-1200");
        expect(normalizeEnglish("he ran 1500-1600 meters")).toBe("he ran 1500-1600 meters");
        expect(normalizeEnglish("revenue 1200-1400 usd")).toBe("revenue 1200-1400 usd");
        expect(normalizeEnglish("call 1800-1234")).toBe("call 1800-1234"); // descending → not a range
        expect(normalizeEnglish("part 1500-1200")).toBe("part 1500-1200");
    });

    test("units, with count agreement, only after a number", () => {
        expect(normalizeEnglish("40 km away")).toBe("40 kilometers away");
        expect(normalizeEnglish("1 km away")).toBe("1 kilometer away");
        expect(normalizeEnglish("64 kph")).toBe("64 kilometers per hour");
        expect(normalizeEnglish("the km marker")).toBe("the km marker"); // bare abbrev in prose → untouched
    });

    // ⚠ THE ONE UNIT ENGLISH GOT WRONG, AND IT WAS NOT A LEAK. `12,700,000 ha` read *…hˈɑː* — the letters
    // are a pronounceable English word, so nothing survived as ASCII and nothing vanished, and the leak
    // classes, the DROP counter and the corpus diff are blind to that by construction. The sentence is
    // this language's own artifact, glossing the unit against acres in the same clause.
    // See tools/normalization/misread.ts.
    test("the hectare, which MIS-READ rather than leaked", () => {
        expect(normalizeEnglish("covering 12,700,000 ha or 31,382,383 acres"))
            .toBe("covering 12,700,000 hectares or 31,382,383 acres");
        expect(normalizeEnglish("1 ha")).toBe("1 hectare"); // count agreement, like every other unit here
        expect(normalizeEnglish("ha ha")).toBe("ha ha");    // only after a NUMBER
    });

    test("roman numerals: cardinal after context words, regnal ordinal otherwise", () => {
        expect(normalizeEnglish("world war ii")).toBe("world war 2");
        expect(normalizeEnglish("chapter iv")).toBe("chapter 4");
        expect(normalizeEnglish("henry viii")).toBe("henry the 8th");
        expect(normalizeEnglish("louis xiv")).toBe("louis the 14th");
        // excluded-by-design: vi/xi are real words, single letters never match
        expect(normalizeEnglish("the vi editor")).toBe("the vi editor");
        expect(normalizeEnglish("x marks")).toBe("x marks");
    });

    test("abbreviations: st/dr disambiguated by neighbor, dot consumed (no phrase break)", () => {
        // saint: abbreviation PRECEDES a name (content word follows)
        expect(normalizeEnglish("the st. james gate brewery")).toBe("the saint james gate brewery");
        expect(normalizeEnglish("st petersburg is in russia")).toBe("saint petersburg is in russia");
        expect(normalizeEnglish("mount st. helens erupted")).toBe("mount saint helens erupted");
        // street/drive: abbreviation FOLLOWS the name (function word or phrase end next)
        expect(normalizeEnglish("main st. in dublin")).toBe("main street in dublin");
        expect(normalizeEnglish("we walked down main st.")).toBe("we walked down main street");
        expect(normalizeEnglish("elm dr. in town")).toBe("elm drive in town");
        // titles
        expect(normalizeEnglish("dr. tony was here")).toBe("doctor tony was here");
        expect(normalizeEnglish("mr. smith met mrs. jones at mt. fuji"))
            .toBe("mister smith met missus jones at mount fuji");
        // untouched: ordinal 1st, bare undotted st before a function word (dict street reading is right)
        expect(normalizeEnglish("the 1st of may")).toBe("the 1st of may");
        expect(normalizeEnglish("main st in dublin")).toBe("main st in dublin");
    });

    test("accented Latin loanwords fold to their ASCII lexicon entry", () => {
        // The tokenizer's word class was [A-Za-z], so an accented word was SPLIT at the accent:
        // "naïve" tokenized as "na"+"ve" → [nˈɑː vˈiː], "résumé" as "r"+"sum" → [ˈɑːɹ sˈʌm].
        // CMUdict is ASCII-keyed (it has cafe/naive/jalapeno/resume, never the accented spellings),
        // so the fix is to accept the letters and fold the diacritics for lookup.
        expect(phonemize("café", "en")).toBe(phonemize("cafe", "en"));
        expect(phonemize("naïve", "en")).toBe(phonemize("naive", "en"));
        expect(phonemize("jalapeño", "en")).toBe(phonemize("jalapeno", "en"));
        // one token, not two
        expect(phonemize("naïve", "en").split(" ")).toHaveLength(1);
        expect(phonemize("résumé", "en").split(" ")).toHaveLength(1);
        // documented conflation: the accent is the only distinction, so the noun takes the verb reading
        expect(phonemize("résumé", "en")).toBe(phonemize("resume", "en"));
        // the curly apostrophe normalises too
        expect(phonemize("don’t", "en")).toBe(phonemize("don't", "en"));
    });

    test("end-to-end: the classes that used to be dropped or garbled", () => {
        expect(phonemize("40% of people", "en")).toContain("pɚsˈɛnt");
        expect(phonemize("$5 million", "en")).toContain("dˈɑːlɚz");
        expect(phonemize("world war ii", "en")).toContain("tʰˈuː");
        expect(phonemize("henry viii", "en")).toContain("ˈeᶦtθ");
    });
});

// INITIALISMS. ⚠ Measured over the CASED column of the FLEURS transcripts (228 all-caps tokens), which is
// what real input looks like — the lowercased column the rest of the suite uses cannot exercise these at all.
describe("english normalization: initialisms", () => {
    test("unpronounceable or dictionary-absent acronyms are spelled out", () => {
        // These were relying on CMUdict happening to contain each acronym. Where it did not, the OOV g2p
        // produced garbage or dropped letters outright — the same silent-loss class as French TGV/PDG.
        expect(phonemize("the NHS trust", "en")).toBe("ðə ˈɛn ˈeᶦt͡ʃ ˈɛs tɹˈʌst"); // was [ns] — H gone
        expect(phonemize("an MP said", "en")).toBe("æn ˈɛm pʰˈiː sˈɛd"); // was [mp]
        expect(phonemize("NYC", "en")).toBe("ˈɛn wˈaᶦ sˈiː"); // was [niːk]
        expect(phonemize("the WTO", "en")).toBe("ðə dˈʌbəɫjuː tʰˈiː ˈoᶷ"); // was [uːt]
        expect(phonemize("DSLR", "en")).toBe("dˈiː ˈɛs ˈɛɫ ˈɑːɹ"); // was [ʌdslɚ]
    });

    test("convention beats the dictionary where the dictionary has the WORD", () => {
        // CMUdict reads "us" as the pronoun [ʌs]; US occurs 18× in the cased column.
        expect(phonemize("the US economy", "en")).toBe("ðə jˈuː ˈɛs ɪkʰˈɑːnəmi");
    });

    test("a dictionary letter-reading is trusted, not re-spelled", () => {
        // CMUdict has cd as ONE token with one stress. Spelling it out would be the same phonemes with
        // worse prosody, so the dictionary branch is deliberately not readability-guarded.
        expect(phonemize("the CD player", "en")).toBe("ðə siːdˈiː plˈeᶦɚ");
    });

    test("lexicalized acronyms stay words; Roman numerals get first refusal", () => {
        expect(phonemize("NASA", "en")).toBe("nˈæsə");
        expect(phonemize("UNESCO", "en")).toBe("juːnˈɛskoᶷ");
        expect(phonemize("HELLO", "en")).toBe("həlˈoᶷ"); // an ordinary word in caps is not an initialism
        expect(phonemize("THE QUICK BROWN FOX", "en")).toBe("ðə kwˈɪk bɹˈaᶷn fˈɑːks"); // all-caps document
        expect(phonemize("Louis XIV", "en")).toBe("lˈuːɪs ðə fˈɔːɹtˈiːnθ"); // not EX-EYE-VEE
    });
});

describe("english normalization: abbreviations, eras, fractions, units", () => {
    test("abbreviations expand and the dot never becomes a pause", () => {
        expect(phonemize("No. 11", "en")).toBe("nˈʌmbɚ ɪlˈɛvən"); // was the word "no" plus a pause
        expect(phonemize("Dr. Who", "en")).toBe("dˈɑːktɚ hˈuː"); // was "drive who" — "who" is a function word
        expect(phonemize("Prof. Jones", "en")).toBe("pɹəfˈɛsɚ d͡ʒˈoᶷnz");
        expect(phonemize("vs. them", "en")).toBe("vˈɝsəs ðˈɛm");
        // The dots were two pause marks. The reading is now the ENGLISH GLOSS rather than the letter
        // names — a choice among interchangeable readings; see the Latin-abbreviation block below.
        expect(phonemize("e.g. this", "en")).toBe("fɔːɹ ɪɡzˈæmpəɫ ðˈɪs");
        expect(phonemize("i.e. that", "en")).toBe("ðæt ɪz ðˈæt");
        expect(phonemize("i.e. 0 or 1", "en")).toContain("ðæt ɪz zˈɪɹoᶷ"); // a DIGIT may follow
        expect(phonemize("at 3 a.m.", "en")).toBe("æt θɹˈiː ˈeᶦ ˈɛm"); // stripping dots alone left the verb "am"
        expect(phonemize("the U.S. team", "en")).toBe("ðə jˈuː ˈɛs tʰˈiːm");
    });

    test("era markers", () => {
        expect(phonemize("5000 BC", "en")).toBe("fˈaᶦv θˈaᶷzənd bˈiː sˈiː");
        expect(phonemize("356 BCE", "en")).toBe("θɹˈiː hˈʌndɹəd fˈɪfti sˈɪks bˈiː sˈiː ˈiː"); // was [bsiː]
        expect(phonemize("in 1066 AD", "en")).toBe("ɪn wˈʌn θˈaᶷzənd sˈɪksti sˈɪks ˈeᶦ dˈiː"); // not "ad"
    });

    test("fractions and negatives", () => {
        expect(phonemize("1/2", "en")).toBe("wˈʌn hˈæf"); // was "one two"
        expect(phonemize("3/4", "en")).toBe("θɹˈiː kwˈɔːɹt̬ɚz");
        expect(phonemize("2/5", "en")).toBe("tʰˈuː fˈɪfθs"); // ordinal denominator, pluralized
        // A dropped sign INVERTS the meaning — the worst class of silent error for a temperature.
        // ⚠ "NEGATIVE", NOT "MINUS": `minus` is the arithmetic OPERATOR and English reserves it for that,
        // using `negative` for a sign on an amount. See step 0f — this rule only ever matches the sign position.
        expect(phonemize("-5 degrees", "en")).toBe("nˈɛɡət̬ɪv fˈaᶦv dᵻɡɹˈiːz");
    });

    test("units that were dropped or read as letter names", () => {
        expect(phonemize("20 °C", "en")).toBe("twˈɛnti dᵻɡɹˈiːz sˈɛɫsiʲəs"); // was "twenty see"
        // ⚠ ℃ / ℉ ARE SINGLE CODE POINTS (U+2103, U+2109), so `°c`/`°f` keys cannot reach them and `20℃`
        // reads as bare "twenty" — the whole unit gone, not merely the sign. Most of the fleet still drops
        // them; ja and ko carry them in their corpora.
        expect(phonemize("20℃", "en")).toBe("twˈɛnti dᵻɡɹˈiːz sˈɛɫsiʲəs");
        expect(phonemize("20℉", "en")).toBe("twˈɛnti dᵻɡɹˈiːz fˈɛɹənhˌaᶦt");
        expect(phonemize("160 km/h", "en")).toBe("wˈʌn hˈʌndɹəd sˈɪksti kəlˈɑːmʌt̬ɚz pʰɝ ˈaᶷɚ"); // /h was "aitch"
        expect(phonemize("30 m", "en")).toBe("θˈɝd̬iː mˈiːt̬ɚz"); // was "thirty em"
        // Space-grouped thousands: the number token cannot span a space, so the thousand was lost.
        expect(phonemize("5 000 years", "en")).toBe("fˈaᶦv θˈaᶷzənd jˈɪɹz");
    });
});

describe("english normalization: alphanumeric codes, money, signs, numeric dates", () => {
    test("all-caps letters attached to digits are a code, not a word", () => {
        // There is no word boundary between the letters and the digits, so these letters reached the g2p
        // raw: "CG4684" came out [kɡ]. A single letter counts here too — English read the bare A of A380
        // as the reduced article [ə].
        expect(phonemize("Flight CG4684", "en")).toBe("flˈaᶦt sˈiː d͡ʒˈiː fˈɔːɹ θˈaᶷzənd sˈɪks hˈʌndɹəd ˈeᶦt̬i fˈɔːɹ");
        expect(phonemize("the A380", "en")).toContain("ˈeᶦ"); // the letter name, not the article
    });

    test("money reads as currency-plus-cents, not as a decimal", () => {
        expect(phonemize("it cost $5.50", "en")).toBe("ɪt kʰˈɑːst fˈaᶦv dˈɑːlɚz fˈɪfti");
        expect(phonemize("$1.99", "en")).toBe("wˈʌn dˈɑːlɚ nˈaᶦnti nˈaᶦn"); // singular at 1
        expect(phonemize("£2.50 each", "en")).toBe("tʰˈuː pʰˈaᶷndz fˈɪfti ˈiːt͡ʃ");
    });

    // ⚠ A GLUED MAGNITUDE ABBREVIATION AFTER A CURRENCY SIGN IS THE MAGNITUDE, NOT THE UNIT — and the
    // discriminator is the sign and nothing else. `$1.5m` used to read *… dˈɑːlɚzəm*: the currency rule runs
    // first and CONSUMES the number, so the `m` was left with nothing to attach to and reached the g2p as a
    // suffix. It was never a version-guard problem — with `NOT_VERSION` removed entirely, `$1.5m`, `£2.3m`
    // and `a $1.5m grant` read identically.
    //
    // Measured over the 162 mined artifacts: 43 glued instances after a currency sign in 15 languages, every
    // one a magnitude, against 1,327 bare `NUMBER+m` in 110 artifacts that are overwhelmingly METRES. The
    // two populations do not overlap, so both halves are pinned here.
    test("a magnitude abbreviation glued to a money figure is million/billion/thousand", () => {
        expect(normalizeEnglish("$1.5m")).toBe("1.5 million dollars");
        expect(normalizeEnglish("a $1.5m grant")).toBe("a 1.5 million dollars grant");
        expect(normalizeEnglish("£2.3m")).toBe("2.3 million pounds");
        expect(normalizeEnglish("$2bn")).toBe("2 billion dollars");
        expect(normalizeEnglish("$700k")).toBe("700 thousand dollars");
        expect(normalizeEnglish("£1M")).toBe("1 million pounds");   // capitals occur too (`$7.32B`)
        expect(normalizeEnglish("$7.32B")).toBe("7.32 billion dollars");
        // ⚠ AND THE SAME LETTERS WITHOUT A SIGN ARE STILL THE UNIT. This is the half a bare-suffix rule
        // would have destroyed, and it is why `naija/normalize.ts` refuses ⟨m⟩ outright: it has no currency
        // guard to lean on, and its own corpus writes `di 100 mita race`.
        expect(phonemize("he ran 100m", "en")).toContain("mˈiːt̬ɚz");
        expect(phonemize("a 5m drop", "en")).toContain("mˈiːt̬ɚz");
        expect(normalizeEnglish("1,854 m")).toBe("1,854 meters");
        // ⚠ THE SPACED FORM IS DECLINED, DELIBERATELY. Fleet-wide it is 3 real instances under a Unicode
        // letter boundary and 12 FALSE ones under an ASCII boundary, where the `m` is the first letter of
        // the next word — and that word is usually the language's own magnitude (`$ 125 mîlyon`,
        // `$500 mílíọ̀nù`, `$50, mängija`). So a space keeps the old reading rather than guessing.
        expect(normalizeEnglish("$5 m")).toBe("5 dollars m");
        // ⚠ AND THE UNATTESTED KEYS ARE LEFT ALONE. ⟨tn⟩ is ×0 across the fleet, which is the same count on
        // which naija declined it. The number must NOT backtrack to `$2` here — see the boundary-guard note
        // in normalize.ts.
        expect(normalizeEnglish("$2.5tn")).toBe("2.5 dollarstn");
        // The spelled form is untouched, and count agreement still holds at 1.
        expect(normalizeEnglish("$5 million")).toBe("5 million dollars");
        expect(normalizeEnglish("$1")).toBe("1 dollar");
        expect(normalizeEnglish("$1m")).toBe("1 million dollars");   // a magnitude forces the plural
        // The cents rule is untouched: it needs a word boundary after the two digits, which a glued letter
        // denies it, so `$2.30bn` never becomes "2 dollars 30".
        expect(normalizeEnglish("$5.50")).toBe("5 dollars 50");
        expect(normalizeEnglish("$2.30bn")).toBe("2.30 billion dollars");
    });

    test("a plus sign is spoken, like the minus", () => {
        // A dropped sign is silent content loss in both directions; "+5" read as "five" is as wrong as
        // "-5" was. The attached form occurs in the corpus as a timezone offset.
        expect(phonemize("a +5 gain", "en")).toBe("ə plˈʌs fˈaᶦv ɡˈeᶦn");
        expect(phonemize("UTC+1 zone", "en")).toBe("jˈuː tʰˈiː sˈiː plˈʌs wˈʌn zˈoᶷn");
    });

    test("numeric dates read as dates", () => {
        // Both forms emit "march 14th 2011", which the ordinal-day and pair-wise-year rules then speak.
        expect(phonemize("on 2011-03-14 it began", "en")).toBe("ˈɑːn mˈɑːɹt͡ʃ fˈɔːɹtˈiːnθ twˈɛnti ɪlˈɛvən ɪt bᵻɡˈæn");
        expect(phonemize("on 3/14/2011 it began", "en")).toBe("ˈɑːn mˈɑːɹt͡ʃ fˈɔːɹtˈiːnθ twˈɛnti ɪlˈɛvən ɪt bᵻɡˈæn");
    });

    test("the lexicalization threshold: long+pronounceable is a word, short is letters", () => {
        // Measured on the 40 all-caps entries of the wikipron referee: every acronym it records with a
        // WORD reading is 4+ letters and pronounceable; every one it records as LETTERS is 2-3 letters or
        // has an illegal cluster. Without this, spelling out was net WORSE on that list (8 better / 14
        // worse); with it, net better (7 / 4).
        // ⚠ SNAV, not SNES: the threshold routes both to the n-gram as a WORD, which is what this pins — but the #1260
        // retrain reads SNES as *sn*, dropping its final letters (held-out: 216 of 11,748 words lose a final
        // consonant, the same 206 the pruned model lost; ISIL → *ˈɪsɪ*, GIF → *ɡˈɪ*). That is the n-gram's own
        // weakness, filed separately, not the threshold's — so the pin uses a shape it reads whole.
        expect(phonemize("SNAV", "en")).toBe("snˈæv"); // 4, pronounceable → word
        expect(phonemize("BAMF", "en")).toBe("bˈæmf");
        expect(phonemize("the NHS", "en")).toBe("ðə ˈɛn ˈeᶦt͡ʃ ˈɛs"); // 3 → letters
        expect(phonemize("the WTO", "en")).toBe("ðə dˈʌbəɫjuː tʰˈiː ˈoᶷ"); // 3 → letters
        expect(phonemize("DSLR", "en")).toBe("dˈiː ˈɛs ˈɛɫ ˈɑːɹ"); // 4 but no vowel → letters
        // Convention still overrides the threshold where the two disagree. The referee records the
        // near-identical USAR as a WORD, which is why this can only be listed, not derived.
        expect(phonemize("a USAF base", "en")).toBe("ə jˈuː ˈɛs ˈeᶦ ˈɛf bˈeᶦs");
    });
});

/**
 * LATIN SCHOLARLY ABBREVIATIONS. `i.e.`, `e.g.`, `N.B.`, `a.m.`/`p.m.` and `(sic)` were already
 * right — they are read as LETTERS or as an ordinary word. These were not: mid-sentence their dot became
 * a phrase break, and two of them were not words at all.
 */
describe("Latin abbreviations and phrases", () => {
    const p = (t: string): string => phonemize(t, "en");

    test("the dot is consumed mid-sentence and kept at a sentence end", () => {
        expect(p("apples, etc. and pears")).not.toContain(" . ");   // was a spurious break
        expect(p("and so on, etc.")).toMatch(/ \.$/u);              // …but a real sentence end stays
        expect(p("Smith et al. found that")).not.toContain(" . ");  // `et al.` is TWO tokens
        expect(p("Smith et al.")).toMatch(/ \.$/u);
        expect(p("see ibid. page 5")).not.toContain(" . ");
    });

    test("cf. and viz. were not words at all", () => {
        expect(p("cf. Smith 1990")).toContain("kəmpˈɛɹ");  // was the cluster [kf] plus a break
        expect(p("viz. the third case")).toContain("nˈeᶦmli"); // was the nonsense word [vɪts]
    });

    test("c. before a year is circa; a bare initial is not", () => {
        expect(p("c. 1500 the town grew")).toContain("sˈɝkə");
        expect(p("John C. Smith wrote")).toContain("sˈiː");  // the letter, via the initials rule
        expect(p("a grade of C. Next term")).toContain(" . "); // a real sentence end survives
    });

    test("the ones that were already correct are unchanged", () => {
        // i.e./e.g. take the ENGLISH GLOSS. All three readings are interchangeable in speech
        // ("for example" / "ee gee" / "exempli gratia"); this is the project's stated preference, and
        // the gloss is the commonest spoken form for e.g. Same two-branch dot handling as the rest.
        expect(p("the rules, i.e. these ones")).toContain("ðæt ɪz");
        expect(p("some fruit, e.g. apples")).toContain("fɔːɹ ɪɡzˈæmpəɫ");
        expect(p("many things, e.g.")).toMatch(/ \.$/u);  // sentence-final dot survives
        expect(p("fruit, e.g. apples, are good")).not.toContain("ɡzˈæmpəɫ . ");
        expect(p("N.B. this matters")).toContain("ˈɛn bˈiː");
        expect(p("at 5 p.m. today")).toContain("pʰˈiː ˈɛm");
        expect(p("he wrote (sic) there")).toContain("sˈɪk");
        expect(p("Ali vs. Frazier")).toContain("vˈɝsəs");
        // Latin PHRASES spelled in full are ordinary dictionary words and need no rule.
        expect(p("ad hoc committee")).toContain("ˈæd hˈɑːk");
        expect(p("a priori reasoning")).toContain("pɹaᶦˈɔːɹaᶦ");
    });

    // ⚠ THE EXPONENT AND THE AMPERSAND WERE DROPPED FLEET-WIDE, because no gate could see either until
    // defects.ts unified the tables — a dropped `²` and a dropped `&` both leave grammatical output.
    test("the exponent and the ampersand", () => {
        // `km²` matched the unit and stranded the `²`, so an AREA read as a length.
        expect(normalizeEnglish("The park covers 19,500 km² and")).toBe("The park covers 19,500 square kilometers and");
        expect(normalizeEnglish("3 m³ of water")).toBe("3 cubic meters of water");
        // The COUNT still governs the noun: "one cubic meter", not "one cubic meters".
        expect(normalizeEnglish("a 1 m³ tank")).toBe("a 1 cubic meter tank");
        expect(normalizeEnglish("1 km of road")).toBe("1 kilometer of road");
        // The ampersand VANISHED, so "Arts & Sciences" read as "Arts Sciences".
        expect(normalizeEnglish("College of Arts & Sciences")).toBe("College of Arts and Sciences");
        expect(normalizeEnglish("B&Bs compete")).toBe("B and Bs compete");
        // THE HTML ENTITY, and both halves of that fix. Unhandled, the bare-`&` rule turned `&amp;` into
        // "and amp;" — a word invented out of markup. Handled without consuming the surrounding spaces, it
        // emitted a DOUBLE SPACE, which is the SLOT-GAP defect class. 0 corpus instances; a phonemizer is
        // handed arbitrary text, and core/markup.ts (which decodes these) is not wired for English.
        expect(normalizeEnglish("Arts &amp; Sciences")).toBe("Arts and Sciences");
        expect(normalizeEnglish("fish &amp; chips")).not.toMatch(/ {2}|amp/u);
    });

    test("the relational and arithmetic signs", () => {
        // ⚠ "BY", NOT "TIMES", when a UNIT follows: English reads a FORMAT as "six by six millimetres" and a
        // PRODUCT as "five times five". `4x4` and `2 x 4` take "by" too — the unspaced/idiomatic form.
        expect(normalizeEnglish("6 × 6 mm")).toBe("6 by 6 millimeters"); // the unit rule also fires
        expect(normalizeEnglish("5 × 5")).toBe("5 times 5");
        // ⚠ ASCII `x` IS THE DOMINANT WRITTEN FORM (~85 `NxN` against ~20 `×`) and was read as the LETTER:
        // `6x6 cm` came out "six EKS six centimetres" — audible garbage no leak or DROP gate could see.
        expect(normalizeEnglish("6x6 cm")).toBe("6 by 6 centimeters");
        expect(normalizeEnglish("a 4x4")).toBe("a 4 by 4");
        expect(normalizeEnglish("12 ÷ 4")).toBe("12 divided by 4");
        expect(normalizeEnglish("x = y")).toBe("x equals y");
        expect(normalizeEnglish("5 < 6")).toBe("5 less than 6");
        expect(normalizeEnglish("7 > 3")).toBe("7 greater than 3");
        expect(normalizeEnglish("±5 degrees")).toBe("plus or minus 5 degrees");
        // `<`/`>` are gated on DIGITS so an HTML tag is not eaten — this corpus's text carries none, but a
        // phonemizer is handed arbitrary text.
        expect(normalizeEnglish("<i>italic</i> text")).toBe("<i>italic</i> text");
    });

    // A RANGE IS NOT A SUBTRACTION, and this is a regression pin. A leading-sign arm that allows a SPACE
    // after the dash (`[−–]\s?`) reads the corpus's `(1418 – 1450)` as "fourteen eighteen MINUS one thousand
    // four hundred fifty". ⚠ Step 0f requires the digit IMMEDIATELY after the dash, which is what keeps a
    // spaced range out; `\s?` is the whole difference between the two behaviours.
    test("a spaced dash between years is never a minus", () => {
        // ⚠ THE RANGE NOW READS AS TWO YEARS, which is what it is — Sejong's reign — and the corpus rows
        // carrying exactly this string improved by 0.106 against both recognizers. The pin this test
        // exists for is unchanged and is the `not.toContain("negative")` assertions below: a range must
        // never become a subtraction. Only the year reading was added on top.
        expect(normalizeEnglish("Sejong (1418 – 1450)")).toBe("Sejong (14 18 – 14 50)");
        // ⚠ ASSERTED ON "negative", NOT "minus" — the word the sign rule now emits. Left as `minus` these
        // three would pass VACUOUSLY, testing nothing, since that word is no longer produced anywhere by this
        // rule. A regression pin has to name the string the code can actually emit.
        expect(normalizeEnglish("from 1990 - 1995")).not.toContain("negative");
        expect(normalizeEnglish("scores 5 - 3")).not.toContain("negative");
        // …while a real negative still reads.
        expect(normalizeEnglish("a -5 degree night")).toBe("a negative 5 degree night");
        expect(normalizeEnglish("COVID-19 cases")).not.toContain("negative");
    });
});

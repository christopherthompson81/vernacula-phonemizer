import { describe, expect, test } from "vitest";

import { normalizeEnglish } from "../src/languages/english/normalize.ts";
import { phonemize } from "../src/index.ts";

// #562 — English text normalization: rewrite non-lexical tokens into speakable words BEFORE the
// tokenizer, so the existing number/ordinal/OOV machinery pronounces them. Asserted mostly at the
// TEXT level (the rewrite is the contract; pronunciation is the number path's own tested concern).
describe("English text normalization (#562)", () => {
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

    test("units, with count agreement, only after a number", () => {
        expect(normalizeEnglish("40 km away")).toBe("40 kilometers away");
        expect(normalizeEnglish("1 km away")).toBe("1 kilometer away");
        expect(normalizeEnglish("64 kph")).toBe("64 kilometers per hour");
        expect(normalizeEnglish("the km marker")).toBe("the km marker"); // bare abbrev in prose → untouched
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

// #562 parity sweep against the French normalization layer: the classes English was missing or getting
// wrong. Measured over the CASED column of the FLEURS transcripts (228 all-caps tokens), which is what
// real input looks like — the lowercased column the rest of the suite uses cannot exercise these.
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
        // A dropped minus INVERTS the meaning — the worst class of silent error for a temperature.
        expect(phonemize("-5 degrees", "en")).toBe("mˈaᶦnəs fˈaᶦv dᵻɡɹˈiːz");
    });

    test("units that were dropped or read as letter names", () => {
        expect(phonemize("20 °C", "en")).toBe("twˈɛnti dᵻɡɹˈiːz sˈɛɫsiʲəs"); // was "twenty see"
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
        expect(phonemize("SNES", "en")).toBe("snˈɛs"); // 4, pronounceable → word
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
 * LATIN SCHOLARLY ABBREVIATIONS (#562). `i.e.`, `e.g.`, `N.B.`, `a.m.`/`p.m.` and `(sic)` were already
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

    // #586's headline case, and en was the FIRST language treated: the exponent and the ampersand were
    // dropped for the whole of #562 because no gate could see them until defects.ts unified the tables.
    test("the exponent and the ampersand, #586's opening examples", () => {
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
        expect(normalizeEnglish("6 × 6 mm")).toBe("6 times 6 millimeters"); // the unit rule also fires
        expect(normalizeEnglish("12 ÷ 4")).toBe("12 divided by 4");
        expect(normalizeEnglish("x = y")).toBe("x equals y");
        expect(normalizeEnglish("5 < 6")).toBe("5 less than 6");
        expect(normalizeEnglish("7 > 3")).toBe("7 greater than 3");
        expect(normalizeEnglish("±5 degrees")).toBe("plus or minus 5 degrees");
        // `<`/`>` are gated on DIGITS so an HTML tag is not eaten — this corpus's text carries none, but a
        // phonemizer is handed arbitrary text.
        expect(normalizeEnglish("<i>italic</i> text")).toBe("<i>italic</i> text");
    });

    // A RANGE IS NOT A SUBTRACTION, and this is a regression pin. Adding a leading-minus arm that allowed a
    // SPACE after the dash (`[−–]\s?`) read the corpus's `(1418 – 1450)` as "fourteen eighteen MINUS one
    // thousand four hundred fifty". Step 0e requires the digit immediately after the dash, which is what
    // keeps a spaced range out; `\s?` is the whole difference between the two behaviours.
    test("a spaced dash between years is never a minus", () => {
        expect(normalizeEnglish("Sejong (1418 – 1450)")).toBe("Sejong (1418 – 1450)");
        expect(normalizeEnglish("from 1990 - 1995")).not.toContain("minus");
        expect(normalizeEnglish("scores 5 - 3")).not.toContain("minus");
        // …while a real negative still reads.
        expect(normalizeEnglish("a -5 degree night")).toBe("a minus 5 degree night");
        expect(normalizeEnglish("COVID-19 cases")).not.toContain("minus");
    });
});

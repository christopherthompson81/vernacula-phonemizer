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
        expect(phonemize("e.g. this", "en")).toBe("ˈiː d͡ʒˈiː ðˈɪs"); // dots were two pause marks
        expect(phonemize("i.e. that", "en")).toBe("ˈaᶦ ˈiː ðˈæt");
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

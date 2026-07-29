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

    test("end-to-end: the classes that used to be dropped or garbled", () => {
        expect(phonemize("40% of people", "en")).toContain("pɚsˈɛnt");
        expect(phonemize("$5 million", "en")).toContain("dˈɑːlɚz");
        expect(phonemize("world war ii", "en")).toContain("tʰˈuː");
        expect(phonemize("henry viii", "en")).toContain("ˈeᶦtθ");
    });
});

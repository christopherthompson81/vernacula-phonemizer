/**
 * #1576 — the az/kk/ky/uz/tk/tt defects the Rust port of the Turkic group found (#1575). Every input here is a
 * SYNTHETIC probe. Where a reading can be stated as a relation to another reading it is (`say(a) === say(b)`), so
 * no IPA is typed; the few literal pins were taken from the engine's own output after the fix.
 */
import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { ROMAN_POLICY as AZ_ROMAN } from "../src/languages/azerbaijani/romanOrdinals.ts";
import { normalizeKazakh } from "../src/languages/kazakh/normalize.ts";
import { MANIFEST as KK } from "../src/languages/kazakh/manifest.ts";
import { numberWords as kyNumberWords } from "../src/languages/kyrgyz/kyrgyz.ts";
import { numberToWords as uzNumberToWords, ordinalWords as uzOrdinalWords } from "../src/languages/uzbek/numbers.ts";
import { normalizeUzbek } from "../src/languages/uzbek/normalize.ts";
import { numberToWords as tkNumberToWords } from "../src/languages/turkmen/numbers.ts";
import { numberToWords as ttNumberToWords } from "../src/languages/tatar/numbers.ts";

const say = (lang: string) => (s: string): string => phonemize(s, lang).trim();
const spaced = (digits: string): string => [...digits].join(" ");
const BIG = "12345678901234567890"; // past 2⁵³: a double reads it as …7000

describe("az", () => {
    const az = say("az");
    test("a numeral past 2⁵³ keeps every digit, and 10²¹ is not read as '1e+21'", () => {
        expect(az(`${BIG} nəfər`)).toBe(az(`${spaced(BIG)} nəfər`));
        expect(az("1000000000000000000000")).toBe(az(spaced("1000000000000000000000")));
    });
    test("a period-thousands number takes a comma decimal", () => {
        expect(az("1.234,5 manat")).toBe(az("1234,5 manat"));
        expect(az("1.234,5 manat")).not.toContain(",");
    });
    test("only the capital BE is the era marker", () => {
        expect(az("BE 1000 il")).toContain("bizˈim");
        expect(az("be 5 il")).not.toContain("bizˈim");
        expect(az("Be 2010")).not.toContain("bizˈim");
    });
    test("the Roman context takes a suffix, not a back-voweled word that starts the same", () => {
        for (const w of ["əsr", "əsrdə", "əsrin", "əsrlər", "sinifdə"]) expect(AZ_ROMAN.ordinalAfter?.test(w)).toBe(true);
        expect(AZ_ROMAN.ordinalAfter?.test("əsrarəngiz")).toBe(false);
        expect(az("XX əsrarəngiz")).toBe(az("20 əsrarəngiz"));
    });
});

describe("kk", () => {
    const kk = say("kk");
    test("10⁹ and 10¹² are milliard and trillion, not 'one thousand million'", () => {
        expect(kk("1000000000")).toBe(KK.numbers.milliard);
        expect(kk("1000000000000")).toBe(KK.numbers.trillion);
        expect(kk("3000000000")).toBe(`${kk("3")} ${KK.numbers.milliard}`);
    });
    test("a numeral past 2⁵³ is read digit by digit", () => {
        expect(kk(BIG)).toBe(kk(spaced(BIG)));
    });
    test("a range keeps a pause between its ends, at a clause end too", () => {
        expect(kk("1977-1981 жылдары")).toBe(kk("1977, 1981 жылдары"));
        expect(kk("137–151.")).toBe(kk("137, 151."));
    });
    test("a case suffix on a unit or a percent attaches to the spoken word", () => {
        expect(kk("5 км-ге")).toBe(kk("5 километрге"));
        expect(kk("20%-ға")).toBe(kk("20 пайызға"));
        expect(kk("3 м-ден")).toBe(kk("3 метрден"));
    });
    test("a round thousand is an ordinal on мың", () => {
        expect(normalizeKazakh("1000-шы жыл")).toBe("бір мыңыншы жыл");
        expect(normalizeKazakh("3000-шы жыл")).toBe("үш мыңыншы жыл");
    });
});

describe("ky", () => {
    const ky = say("ky");
    test("stress is word-final, and a medial cluster splits", () => {
        expect(ky("китептер")).toBe("kitepˈter");
        expect(ky("спорт")).toBe("ˈsport");
        expect(ky("тоо")).toBe("ˈtoː");
    });
    test("10¹² is триллион, and a safe integer above it still composes", () => {
        expect(kyNumberWords(1e12)).toBe("бир триллион");
        expect(kyNumberWords(2e15)).toBe("эки миң триллион");
    });
    test("a dot with one fractional digit is a decimal, read as the comma's", () => {
        expect(ky("2.5 версия")).toBe(ky("2,5 версия"));
        expect(ky("12.00дө")).not.toContain("byˈtyn"); // two digits stay a clock
    });
    test("барабар follows the second operand, not the rest of the clause", () => {
        expect(ky("а = б жана в")).toBe(ky("а б барабар жана в"));
        expect(ky("1 теңге = 100 тыйынга")).toBe(ky("1 теңге 100 тыйынга барабар"));
    });
});

describe("uz", () => {
    test("10¹² is trillion", () => {
        expect(uzNumberToWords(1e12)).toBe("bir trillion");
        expect(uzNumberToWords(3e12 + 5)).toBe("uch trillion besh");
    });
    test("past 2⁵³ the composer gives nothing, and the regbi exception leaves the digits", () => {
        expect(uzNumberToWords(Number(BIG))).toBe("");
        expect(normalizeUzbek(`${BIG}-regbi`)).toContain(BIG);
    });
    test("the documented ordinal of 190 is what the code returns", () => {
        expect(uzOrdinalWords(190)).toBe("yuz toʻqsoninchi");
    });
});

describe("tk", () => {
    const tk = say("tk");
    test("stress splits a medial cluster; a word-initial cluster is the onset", () => {
        expect(tk("kitaplar")).toBe("kitɑpˈlɑɾ");
        expect(tk("ilkinji")).toBe("ilkinˈd͡ʒi");
        expect(tk("plýus")).toBe("ˈpljuθ");
    });
    test("a spaced en dash is punctuation, an attached one a sign", () => {
        expect(tk("Ilkinji ýyl – 1995.")).not.toContain("miˈnuθ");
        expect(tk("–5 gradus")).toBe(tk("-5 gradus"));
    });
    test("the exported composer refuses what is not a non-negative integer", () => {
        expect(tkNumberToWords(NaN)).toEqual([]);
        expect(tkNumberToWords(-5)).toEqual([]);
        expect(tkNumberToWords(2.5)).toEqual([]);
    });
});

describe("tt", () => {
    const tt = say("tt");
    test("ъ: glottal stop natively, uvular after к г, /j/ before an iotated vowel", () => {
        expect(tt("мәсъәлә")).toBe("mæsʔæˈlæ");
        expect(tt("мәгънә")).toBe("mæʁˈnæ");
        expect(tt("мәкъалә")).toBe("mæqaˈlæ");
        expect(tt("съезд")).toBe("ˈsjezd");
        expect(tt("йөзъеллык")).toBe("jøzjelˈlɨq");
    });
    test("stress splits a medial cluster", () => {
        expect(tt("китаплар")).toBe("kitapˈlar");
        expect(tt("спорт")).toBe("ˈsport");
    });
    test("10¹² is триллион", () => {
        expect(ttNumberToWords(1e12)).toEqual(["бер", "триллион"]);
    });
});

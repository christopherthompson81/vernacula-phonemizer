/**
 * Russian defects the Rust port found (#1513). Probe text is synthetic. Expectations are the WORDS the
 * normalizer writes (the reading the fix intends), or relations between two engine outputs — never typed IPA.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { MANIFEST } from "../src/languages/russian/manifest.ts";
import { normalizeRussian } from "../src/languages/russian/normalize.ts";
import { numberToWords } from "../src/languages/russian/numbers.ts";
import { phonemizeWord } from "../src/languages/russian/russian.ts";

describe("ru: an abbreviation's dot that also ends the sentence is kept (1)", () => {
    test("before a capital, the post-numeral abbreviations keep the dot", () => {
        expect(normalizeRussian("К 1990 г. Затем пришли.")).toBe("К 1990 года. Затем пришли.");
        expect(normalizeRussian("в 2007 г. Затем")).toBe("в 2007 году. Затем");
        expect(normalizeRussian("5 тыс. Затем")).toBe("5 тысяч. Затем");
        expect(normalizeRussian("в XV в. Затем")).toBe("в XV века. Затем");
    });
    test("before a lowercase word or a mark the dot is still consumed, and a preposed one never ends", () => {
        expect(normalizeRussian("в 2007 г. мы")).toBe("в 2007 году мы");
        expect(normalizeRussian("в 2007 г., мы")).toBe("в 2007 году, мы");
        expect(normalizeRussian("в 1990 г. в 2000 г. мы")).toBe("в 1990 году в 2000 году мы");
        expect(normalizeRussian("ул. Ленина")).toBe("улица Ленина");
        expect(normalizeRussian("проф. Иванов")).toBe("профессор Иванов");
    });
});

describe("ru: the initials В. and Г. are letters, not века / года (2)", () => {
    test("a capital single letter before a capitalised name is spelled by its name", () => {
        const v = MANIFEST.letterNames["в"]!, g = MANIFEST.letterNames["г"]!;
        expect(normalizeRussian("В. Петров и Г. Иванов")).toBe(`${v} Петров и ${g} Иванов`);
        expect(normalizeRussian("В. В. Набоков")).toBe(`${v} ${v} Набоков`);
    });
});

describe("ru: the fraction's denominator takes the numerator's count (3)", () => {
    test("a numerator ending in 1 keeps the singular; every other takes the genitive plural", () => {
        expect(normalizeRussian("2/3")).toBe("две третьих");
        expect(normalizeRussian("5/8")).toBe("пять восьмых");
        expect(normalizeRussian("3/2")).toBe("три вторых");
        expect(normalizeRussian("11/5")).toBe("одиннадцать пятых");
        expect(normalizeRussian("1/5")).toBe("одна пятая");
        expect(normalizeRussian("21/100")).toBe("двадцать одна сотая");
    });
});

describe("ru: clock minutes agree with the feminine минута (4)", () => {
    test("1 and 2 take одна / две; the hour stays masculine", () => {
        expect(normalizeRussian("9:21")).toBe("девять часов двадцать одна минута");
        expect(normalizeRussian("1:01")).toBe("один час одна минута");
        expect(normalizeRussian("3:02")).toBe("три часа две минуты");
        expect(normalizeRussian("12:11")).toBe("двенадцать часов одиннадцать минут");
    });
});

describe("ru: a case suffix after digits reads the oblique cardinal where it ends one (5)", () => {
    test("-х, -ти, -мя", () => {
        expect(normalizeRussian("в 4-х томах")).toBe("в четырёх томах");
        expect(normalizeRussian("30-ти лет")).toBe("тридцати лет");
        expect(normalizeRussian("35-ти")).toBe("тридцати пяти");
        expect(normalizeRussian("34-мя годами")).toBe("тридцатью четырьмя годами");
    });
    test("-х that no cardinal form ends in stays the ordinal", () => {
        expect(normalizeRussian("5-х классов")).toBe("пятых классов");
        expect(normalizeRussian("12-х")).toBe("двенадцатых");
        expect(normalizeRussian("1970-х")).toBe("тысяча девятьсот семидесятых");
    });
});

describe("ru: вся is not a reflexive (6)", () => {
    test("its с is soft; a real reflexive keeps the hard one", () => {
        const [hard, soft] = MANIFEST.consonants["с"]!;
        expect(phonemizeWord("вся")).toContain(soft);
        expect(phonemizeWord("вернулся").endsWith(`${hard}ə`)).toBe(true);
    });
});

describe("ru: Cyrillic letters outside а–я/ё fold to their Russian spelling (7)", () => {
    test("the word is read whole, as its Russian spelling", () => {
        expect(phonemize("хлѣбъ", "ru")).toBe(phonemize("хлебъ", "ru"));
        expect(phonemize("Київ", "ru")).toBe(phonemize("Кийив", "ru"));
        expect(phonemize("ґанок", "ru")).toBe(phonemize("ганок", "ru"));
        expect(phonemize("Ѳеатръ", "ru")).toBe(phonemize("Феатръ", "ru"));
        expect(phonemize("хлѣбъ", "ru")).not.toContain(" ");
    });
});

describe("ru: a lone thousand is тысяча, the news reading of a year (9)", () => {
    test("only the group that IS one drops одна", () => {
        expect(numberToWords(1900)).toBe("тысяча девятьсот");
        expect(numberToWords(1000)).toBe("тысяча");
        expect(numberToWords(21000)).toBe("двадцать одна тысяча");
        expect(numberToWords(2000)).toBe("две тысячи");
    });
});

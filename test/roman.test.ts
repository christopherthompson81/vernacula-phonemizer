import { describe, expect, test } from "vitest";

import { normalizeRomans, romanToInt, ROMAN_EXCLUSIONS } from "../src/core/roman.ts";
import { phonemize } from "../src/index.ts";

// Shared Roman-numeral normalization: rewrite to DIGITS so each language's own cardinal compositor
// pronounces it. The hard part is homographs — many valid Roman numerals are ordinary words or
// abbreviations — so most of these tests pin what must NOT convert.
describe("Roman numerals (core/roman.ts)", () => {
    test("romanToInt decodes canonical forms", () => {
        expect(romanToInt("XIV")).toBe(14);
        expect(romanToInt("xix")).toBe(19);
        expect(romanToInt("MCMLXXXIV")).toBe(1984);
        expect(romanToInt("XL")).toBe(40);
        expect(romanToInt("CD")).toBe(400);
        expect(romanToInt("MMXXV")).toBe(2025);
        expect(romanToInt("i")).toBe(1); // decodes; whether it's USABLE is normalizeRomans' call
    });

    test("romanToInt rejects non-canonical and non-Roman", () => {
        expect(romanToInt("IIII")).toBeNull(); // additive four
        expect(romanToInt("XXXX")).toBeNull();
        expect(romanToInt("IC")).toBeNull(); // illegal subtractive
        expect(romanToInt("hello")).toBeNull();
        expect(romanToInt("")).toBeNull();
        expect(romanToInt("mild")).toBeNull(); // Roman letters, not a Roman numeral
        expect(romanToInt("civic")).toBeNull();
    });

    test("ALL-CAPS in mixed-case text unlocks the WIDER set", () => {
        expect(normalizeRomans("Louis XIV")).toBe("Louis 14");
        expect(normalizeRomans("siglo XVIII")).toBe("siglo 18");
        expect(normalizeRomans("XIX век")).toBe("19 век");
        // Beyond the closed set, conversion needs the case signal: capitals amid lowercase.
        expect(normalizeRomans("in MCMLXXXIV he")).toBe("in 1984 he");
        // In an ALL-CAPS run the capitals carry no signal, so only the closed set converts —
        // XIV is unambiguous either way, MCMLXXXIV is not.
        expect(normalizeRomans("LOUIS XIV")).toBe("LOUIS 14");
        expect(normalizeRomans("LOUIS MCMLXXXIV")).toBe("LOUIS MCMLXXXIV");
    });

    test("lowercase converts only for the unambiguous closed set", () => {
        expect(normalizeRomans("siglo xix")).toBe("siglo 19");
        expect(normalizeRomans("papa giovanni xxiii")).toBe("papa giovanni 23");
        expect(normalizeRomans("capitolo viii")).toBe("capitolo 8");
        // outside the closed set, a lowercase token is left alone even though it decodes
        expect(normalizeRomans("mcmlxxxiv")).toBe("mcmlxxxiv");
    });

    test("homographs are never converted", () => {
        // metric and size abbreviations that are valid Roman numerals
        for (const w of ["mm", "cm", "ml", "dl", "cl", "cc", "xl", "cd"])
            expect(normalizeRomans(`5 ${w}`)).toBe(`5 ${w}`);
        // short words across Romance / Nordic / Slavic / Turkic
        for (const w of ["di", "vi", "ci", "li", "mi", "xi"])
            expect(normalizeRomans(`casa ${w} roma`)).toBe(`casa ${w} roma`);
        // longer words that happen to be valid Roman numerals
        for (const w of ["mix", "div", "civ", "liv", "lix", "dix"])
            expect(normalizeRomans(`the ${w} thing`)).toBe(`the ${w} thing`);
        // single letters are never numerals here (I, V, X, C, D, M, L)
        expect(normalizeRomans("I am")).toBe("I am");
        expect(normalizeRomans("vitamin C and D")).toBe("vitamin C and D");
    });

    test("per-language exclusions", () => {
        // Romanian "vii" = alive / vines, homograph of VII
        expect(normalizeRomans("vii", { exclude: ROMAN_EXCLUSIONS.ro })).toBe("vii");
        expect(normalizeRomans("vii")).toBe("7"); // no policy → the closed set applies
    });

    test("end-to-end: the numeral is now SPOKEN, not dropped or letter-spelled", () => {
        // Russian dropped the Latin run entirely before this pass existed
        expect(phonemize("xix век", "ru")).toContain("vʲek");
        expect(phonemize("xix век", "ru").split(" ").length).toBeGreaterThan(1);
        // Spanish reads centuries as CARDINALS (RAE: "del siglo XI en adelante, solo es normal su
        // lectura como cardinales"), so this is the correct register for it — not a fallback.
        expect(phonemize("siglo xix", "es")).toContain("djeθinwˈeβe");
        // Italian reads them as ORDINALS, including regnal names, per its own policy (Treccani).
        expect(phonemize("papa giovanni xxiii", "it")).toContain("ventitreezˈimo");
        expect(phonemize("xix secolo", "it")).toContain("dit͡ʃannovezˈimo");
        // ...while a BARE Italian numeral has no ordinal context and stays a cardinal.
        expect(phonemize("xix", "it")).toContain("dit͡ʃannˈove");
    });

    test("large values: numbered events and regnal names beyond the closed set", () => {
        // The closed lowercase set stops at 20, so these need the case-gated any-value branch.
        // Super Bowls are read as CARDINALS ("Super Bowl fifty-eight"), regnal names as ordinals.
        expect(phonemize("Super Bowl LVIII", "en")).toContain("fˈɪfti ˈeᶦt");
        expect(phonemize("Super Bowl LIX", "en")).toContain("fˈɪfti nˈaᶦn");
        expect(phonemize("WrestleMania XL", "en")).toContain("fˈɔːɹt̬i");
        expect(phonemize("Louis XVI", "en")).toContain("sɪkstˈiːnθ");
        expect(phonemize("Pope John XXIII", "en")).toContain("twˈɛnti θˈɝd");
        // ...while an all-caps ACRONYM after a non-evidence word must stay an acronym.
        expect(phonemize("the CD player", "en")).toContain("siːdˈiː");
        expect(phonemize("a size XL shirt", "en")).not.toContain("fˈɔːɹt̬i");
        // Non-English keeps the shared pass, which handles any value via the cardinal path.
        expect(phonemize("Super Bowl LVIII", "es")).toContain("θinkwˈenta i ˈot͡ʃo");
    });

    test("languages that resolve Romans themselves are not pre-empted", () => {
        // English keeps its regnal-vs-cardinal context rule (the shared pass would flatten both to a cardinal)
        expect(phonemize("henry viii", "en")).toContain("ˈeᶦtθ"); // "the eighth", an ordinal
        expect(phonemize("world war ii", "en")).toContain("tʰˈuː"); // cardinal, per the context word
        // French keeps its ordinal XIVe
        expect(phonemize("xive siècle", "fr")).toContain("katɔʁzjɛm");
    });

    test("homographs still phonemize as words in their own language", () => {
        expect(phonemize("vi", "da")).toBe("ˈviːˀ"); // Danish "we", not 6
        expect(phonemize("mi", "hu")).toBe("ˈmi"); // Hungarian "we", not 1001
        expect(phonemize("vii", "ro")).toBe("ˈvij"); // Romanian "alive", not 7
    });
});

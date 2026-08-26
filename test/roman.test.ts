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
        expect(phonemize("siglo xix", "es")).toContain("ðjeθinwˈeβe");
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

/** a Roman-looking letter glued to a digit is part of an alphanumeric code, not a numeral. */
describe("digit-glued candidates are never numerals", () => {
    test("a letter touching a digit is left alone", () => {
        // The numeral-context licence deliberately bypasses the single-letter guard, so without this an
        // ordinal context turned the C of `JAS 39C Gripen` into "hundredth". Found by the Hungarian run.
        expect(normalizeRomans("A JAS 39C Gripen")).toBe("A JAS 39C Gripen");
        expect(normalizeRomans("B2 vitamin")).toBe("B2 vitamin");
        expect(normalizeRomans("Boeing 747X")).toBe("Boeing 747X");
        expect(normalizeRomans("X5 BMW")).toBe("X5 BMW");
    });

    test("…and a free-standing numeral still converts", () => {
        expect(normalizeRomans("Louis XVI")).toBe("Louis 16");
        expect(normalizeRomans("el siglo XIX")).toBe("el siglo 19");
    });
});

/** a contiguous run of single capitals is INITIALS, not numerals. */
describe("initial runs are not numerals", () => {
    test("two adjacent single capitals are left alone", () => {
        // `D` is Roman 500; a regnal rule licensing a following capitalised word turned
        // `D K Arya` into "five-hundredth K Arya". Same contiguity principle as J. S. Bach.
        expect(normalizeRomans("D K Arya")).toBe("D K Arya");
        expect(normalizeRomans("M C Escher")).toBe("M C Escher");
        expect(normalizeRomans("X Y Z")).toBe("X Y Z");
    });

    test("…a lone capital stays ambiguous and a real numeral still converts", () => {
        expect(normalizeRomans("Louis XVI")).toBe("Louis 16");
        expect(normalizeRomans("el siglo XIX")).toBe("el siglo 19");
    });

    test("the Hungarian regnal ordinal now lands", () => {
        expect(phonemize("II. Erzsébet", "hu")).toContain("maːʃodik");
        expect(phonemize("XVI. Lajos", "hu")).toContain("tizɛnhɒtodik");
        expect(phonemize("A JAS 39C Gripen", "hu")).not.toContain("saːzɒdik");
    });
});

describe("all-caps abbreviations that are canonical numerals", () => {
    // The stoplist was measured over the 163 mined corpora, not guessed: every all-caps token that is a
    // canonical Roman numeral and would convert was counted and its contexts read. Below the genuine
    // numerals (II ×657, III ×295, IV ×183 …) sits a band of nine tokens, 121 occurrences, with ZERO
    // numeral uses among them. Each case here is a real corpus line.
    test("the measured band never converts", () => {
        expect(normalizeRomans("i Washington DC")).toBe("i Washington DC"); // 600
        expect(normalizeRomans("MV Nyayo na MV Harambee")).toBe("MV Nyayo na MV Harambee"); // 1005
        expect(normalizeRomans("Daniel McGuire, MD, a me")).toBe("Daniel McGuire, MD, a me"); // 1500
        expect(normalizeRomans("iyo 140 CV oo loo rogay")).toBe("iyo 140 CV oo loo rogay"); // 105
        expect(normalizeRomans("Atlas LV-3 Agena-D ar")).toBe("Atlas LV-3 Agena-D ar"); // 55
        expect(normalizeRomans("Suomen DX-Liitto ja")).toBe("Suomen DX-Liitto ja"); // 510
        expect(normalizeRomans("1 km iz DV nu Rasnupļu")).toBe("1 km iz DV nu Rasnupļu"); // 505
        expect(normalizeRomans("Gael-Linn CEF 080 & MC, 1979")).toBe("Gael-Linn CEF 080 & MC, 1979"); // 1100
        expect(normalizeRomans("ႁွင်ႈလုမ်း CCC ၶဝ်သေ")).toBe("ႁွင်ႈလုမ်း CCC ၶဝ်သေ"); // 300
    });

    test("…but an explicit numeral context still licenses one", () => {
        // The stoplist refuses the ambiguous bare case; it must not refuse text that says outright a
        // numeral is meant. `XL` is a clothing size AND the 40th anniversary.
        expect(phonemize("el XL aniversario", "es")).toContain("kwaðɾaxˈesimo");
        expect(phonemize("el siglo XIX", "es")).toContain("ðjeθinwˈeβe");
    });
});

describe("English 7a: the capitalized-previous-word signal is the weak one", () => {
    // On its own it read every all-caps abbreviation following a name as a numeral. core/roman.ts
    // already owned the measured list; English simply was not consulting it. One list, two engines.
    test("an abbreviation after a name is not a numeral", () => {
        expect(phonemize("Washington DC is the capital", "en")).not.toContain("hˈʌndɹədθ");
        expect(phonemize("a Sony CD player", "en")).not.toContain("hˈʌndɹədθ");
        expect(phonemize("Detroit MI has", "en")).not.toContain("θˈaᶷzənd");
        expect(phonemize("Boeing MD is old", "en")).not.toContain("hˈʌndɹədθ");
        expect(phonemize("Ocean Express MV docked", "en")).not.toContain("θˈaᶷzənd");
        expect(phonemize("Paris DX radio", "en")).not.toContain("tʰˈɛnθ");
    });

    test("…while a numbered-event noun still licenses a stoplisted token", () => {
        // Both of these are IN the stoplist and both are genuine numerals here. A blanket check loses them.
        expect(phonemize("Apollo XI landed", "en")).toContain("ɪlˈɛvən");
        expect(phonemize("WrestleMania XL was", "en")).toContain("fˈɔːɹt̬i");
    });

    test("…and the ordinary regnal and event readings are untouched", () => {
        expect(phonemize("Louis XVI reigned", "en")).toContain("sɪkstˈiːnθ");
        expect(phonemize("Queen Elizabeth II spoke", "en")).toContain("sˈɛkənd");
        expect(phonemize("Super Bowl LVIII was", "en")).toContain("fˈɪfti ˈeᶦt");
        expect(phonemize("World War II ended", "en")).toContain("tʰˈuː");
    });
});

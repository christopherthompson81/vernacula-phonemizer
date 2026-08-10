import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { degroupThousands, readDecimals, readDegrees, reorderFraction, spellHanDigits, spellYears } from "../src/core/sinitic.ts";

/**
 * The shared Sinitic number rules — and, more to the point, the DEFECTS they exist to stop being
 * rediscovered. Five Han-orthography layers (cmn, yue, wuu, nan, cjy) each grew these separately; the
 * measurement that justified extracting them, and the live bug the drift had already shipped, are in
 * `src/core/sinitic.ts` and `docs/investigations/sinitic_core_investigation.md`.
 *
 * ⚠ EVERY TEST HERE IS A REGRESSION FROM A REAL DEFECT, not a specification exercise.
 */
describe("core/sinitic — the shared rules", () => {
    test("⚠ a grouping comma DESTROYS the value, and the guard is exactly-3-digit groups", () => {
        expect(degroupThousands("1,000人")).toBe("1000人");
        expect(degroupThousands("181,040 km²")).toBe("181040 km²");
        // ⚠ THE CHINESE FOUR-DIGIT GROUPING IS LEFT ALONE — `1,8638.36亿元` is a 万-grouping, not thousands.
        expect(degroupThousands("1,8638.36亿元")).toBe("1,8638.36亿元");
        // …and it cannot reach a decimal, a clock or a DOI, which is what the 3-digit requirement buys.
        expect(degroupThousands("3,5")).toBe("3,5");
        expect(degroupThousands("10.1016/j.x")).toBe("10.1016/j.x");
    });

    test("⚠ THE YEAR ARMS MUST RUN range → both-endpoints → single, and that order was learned 3×", () => {
        // Rediscovered in yue, wuu and cjy: only the RIGHT endpoint of `1996-2007年` sees 年, so with the
        // single rule first the span gets a cardinal and a digit reading at once.
        expect(spellYears("1996-2007年", { rangeWord: "到" })).toBe("一九九六到二零零七年");
        // …and the both-endpoints arm must ALSO precede it: after it, both endpoints are Han and no digit
        // pattern can reach the dash.
        expect(spellYears("1996年-2007年", { rangeWord: "到" })).toBe("一九九六年到二零零七年");
        expect(spellYears("2009年", {})).toBe("二零零九年");
        // ⚠ ACROSS WHITESPACE — `2009 年` is ordinary in Han corpora, and missing it silently defeated cmn.
        expect(spellYears("2009 年", {})).toBe("二零零九 年");
        // ⚠ 3-DIGIT YEARS KEEP THE CARDINAL: most short `N年` forms are DURATIONS (`48年歷史`).
        expect(spellYears("221年", {})).toBe("221年");
    });

    test("⚠ A SLASHED YEAR PAIR IS NOT A FRACTION — five languages met this shape", () => {
        // jv guarded it (`taun 1985/1986`); nan's whole fraction rule was removed when its only digit/digit
        // slash was `Fahrenheit 9/11`; cjy caught it in review; wuu and yue were carrying it unnoticed
        // until this extraction, which is the clearest argument the shared module has.
        expect(reorderFraction("2020/2021", "分之")).toBe("2020/2021");
        expect(reorderFraction("1985/1986", "分之")).toBe("1985/1986");
        expect(reorderFraction("1/5", "分之")).toBe("5分之1");
        expect(reorderFraction("至少2/3贊同票", "分之")).toBe("至少3分之2贊同票");
    });

    test("⚠ A FRACTION FUSED TO A LATIN LETTER IS A CODE — found by the first language built ON this module", () => {
        // hak.wikipedia's rolling-stock articles write train-set numbers as `A/C/B351/352`, and the
        // digit-only lookbehind let every one through: *…352分之351*, "351 over 352". Nothing legitimate is
        // written with a fraction fused to a letter, so the guard costs nothing — verified byte-identical
        // over the cmn, yue, wuu, nan and cjy corpora.
        expect(reorderFraction("A/C/B351/352", "分之")).toBe("A/C/B351/352");
        expect(reorderFraction("SP1900/1950", "分之")).toBe("SP1900/1950");
        // …and a real fraction still reads: a space or a Han character precedes it.
        expect(reorderFraction("Fahrenheit 9/11", "分之")).toBe("Fahrenheit 11分之9");
        expect(reorderFraction("即1/1000", "分之")).toBe("即1000分之1");
    });

    test("decimals: the tail is digit-by-digit, and a dotted designation is not a decimal", () => {
        expect(readDecimals("3.5", "點")).toBe("3點五");
        expect(readDecimals("6.34", "點")).toBe("6點三四"); // never 六點三十四
        // ⚠ `(?!\.\d)` — earned in the jv layer, where `nomer 1.2.3` read *siji koma loro . telu*.
        expect(readDecimals("1.2.3", "點")).toBe("1.2.3");
        expect(readDecimals("10.1016", "點")).toBe("10.1016"); // a DOI: the 3-digit cap keeps it out
    });

    test("⚠ THE DEGREE RULE'S `\\s*` IS THE BUG THE EXTRACTION FOUND", () => {
        // Cantonese shipped `\s?` — at most ONE space — while wu and nan used `\s*`. Two spaces is ordinary
        // typography (the wuu corpus writes `15.5 °C`), so `20  °C` lost its unit in yue and nowhere else.
        const d = { celsius: (n: string) => `攝氏${n}度`, fahrenheit: (n: string) => `華氏${n}度` };
        for (const s of ["20°C", "20 °C", "20  °C"]) expect(readDegrees(s, d), s).toBe("攝氏20度");
        expect(readDegrees("68 °F", d)).toBe("華氏68度");
        // ⚠ THE GUARD IS `\p{sc=Latn}`, NOT `\p{L}` — a HAN character IS `\p{L}`, and with the wrong guard
        // `溫度10°C到2°C` failed in nan and fused the degree word onto the stranded ⟨C⟩.
        expect(readDegrees("溫度10°C到2°C", d)).toBe("溫度攝氏10度到攝氏2度");
        // The positions are per-language, which is why the rule takes FUNCTIONS: wu POSTposes Celsius.
        expect(readDegrees("17°C", { celsius: (n) => `${n}摄氏度` })).toBe("17摄氏度");
    });

    test("⚠ THE NUMBER INCLUDES ITS DECIMAL PART — a shipped bug in every PREPOSING language", () => {
        // The pattern captured `(\d+)`, which on `13.3 °C` matches only the `3`, so the scale word landed
        // INSIDE the number: yue and nan both read it as `13.` + 攝氏三度 — the integer part orphaned in
        // front of a raw stop and the temperature off by a factor of four.
        const pre = { celsius: (n: string) => `攝氏${n}度`, fahrenheit: (n: string) => `華氏${n}度` };
        expect(readDegrees("13.3 °C", pre)).toBe("攝氏13.3度");
        expect(readDegrees("34.2°C", pre)).toBe("攝氏34.2度");
        expect(readDegrees("98.6°F", pre)).toBe("華氏98.6度");
        expect(readDegrees("23.5°", { bare: (n) => `${n}度` })).toBe("23.5度");
        // ⚠ WHY IT SURVIVED FOUR LAYERS: wu POSTposes, so the split reassembles to the same string and the
        // defect is invisible from exactly the one language that puts the word on the other side.
        expect(readDegrees("13.3°C", { celsius: (n) => `${n}摄氏度` })).toBe("13.3摄氏度");
        // ⚠ THE INTEGER ARM IS UNCHANGED — the decimal part is optional.
        expect(readDegrees("20°C", pre)).toBe("攝氏20度");
    });

    test("spellHanDigits leaves a non-digit alone", () => {
        expect(spellHanDigits("2009")).toBe("二零零九");
        expect(spellHanDigits("1a2")).toBe("一a二");
    });
});

describe("core/sinitic — the guard now holds in every language that shares it", () => {
    // ⚠ THE POINT OF THE EXTRACTION: before it, this shape was guarded in cjy and latent in wuu and yue.
    test("no Sinitic layer reads a slashed year pair as a fraction", () => {
        for (const lang of ["yue", "wuu", "cjy"] as const) {
            expect(phonemize("2020/2021", lang), lang).toBe(phonemize("2020 2021", lang));
            expect(phonemize("1/5", lang), lang).not.toBe(phonemize("1 5", lang)); // …but a real fraction still reads
        }
    });

    test("no Sinitic layer loses a temperature to a second space", () => {
        for (const lang of ["yue", "wuu"] as const)
            expect(phonemize("20  °C", lang), lang).toBe(phonemize("20°C", lang));
    });
});

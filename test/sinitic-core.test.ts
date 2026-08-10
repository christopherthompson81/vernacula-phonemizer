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

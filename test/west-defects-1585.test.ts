/**
 * #1585: number and unit misreadings in the west group that the Rust port found (cy, ga, eu, an, ast, oc).
 * Synthetic probes. Relational wherever a well-formed twin exists, so no IPA is typed; the text-level
 * assertions check the normalizers' own output. Mirrored in C# (`WestDefects1585Tests.cs`) and Rust (each
 * language's own test module).
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { normalizeAragonese } from "../src/languages/aragonese/normalize.ts";
import { normalizeAsturian } from "../src/languages/asturian/normalize.ts";
import { normalizeBasque } from "../src/languages/basque/normalize.ts";
import { normalizeIrish } from "../src/languages/irish/normalize.ts";
import { normalizeOccitan } from "../src/languages/occitan/normalize.ts";
import { normalizeWelsh } from "../src/languages/welsh/normalize.ts";

const say = (text: string, lang: string): string => phonemize(text, lang).trim();

describe("cy (#1585)", () => {
    test("a glued metre after a decimal is the unit, not the letter", () => {
        expect(say("4.5m", "cy")).toBe(say("4.5 m", "cy"));
        expect(say("802.11n", "cy")).not.toBe(say("802.11 metr", "cy")); // the version letter is still a letter
    });
    test("km is cilomedr after a range and a decimal, as everywhere else", () => {
        const km = say("5 km", "cy").split(" ").at(-1);
        expect(say("2.5 km", "cy").split(" ").at(-1)).toBe(km);
        expect(say("1-2 km", "cy").split(" ").at(-1)).toBe(km);
        expect(normalizeWelsh("1-2 km")).toContain("cilomedr");
    });
    test("a denominator below 2 names no fraction", () => {
        expect(normalizeWelsh("1/0")).toBe("1/0");
        expect(normalizeWelsh("1/1")).toBe("1/1");
        expect(normalizeWelsh("1/2")).toBe("hanner"); // the fraction rule still runs
    });
});

describe("ga (#1585)", () => {
    test("a clause-final score keeps its connective", () => {
        expect(normalizeIrish("Bhí sé 5-3.")).toBe("Bhí sé 5 go dtí 3.");
        expect(normalizeIrish("1.5-2.5")).not.toContain("go dtí"); // a decimal continuation is still declined
    });
    test("1/2 is leath", () => {
        expect(normalizeIrish("1/2")).toBe("leath");
        expect(normalizeIrish("1/5")).toBe("an cúigiú"); // the other unit fractions are unchanged
    });
    test("a glued metre after a decimal is the unit", () => {
        expect(say("4.5m", "ga")).toBe(say("4.5 m", "ga"));
    });
});

describe("eu (#1585)", () => {
    test("a bare degree sign is gradu, with a glued case ending on it", () => {
        expect(normalizeBasque("20°")).toBe("20 gradu");
        expect(normalizeBasque("20º")).toBe("20 gradu"); // the file's own º → ° fold
        expect(normalizeBasque("10°tik")).toBe("10 gradutik");
        expect(normalizeBasque("26 °C")).toBe("26 gradu Celsius"); // the scale is still read
    });
    test("a dot decimal is koma, not a sentence break", () => {
        expect(say("2.5 km", "eu")).toBe(say("2,5 km", "eu"));
        expect(say("8.0ko", "eu")).toBe(say("8,0ko", "eu"));
        expect(normalizeBasque("Am 2.18.19-26")).not.toContain("koma"); // a dotted citation is declined
    });
    test("a hyphenated e-initial ending glues to a consonant-final figure", () => {
        expect(say("5-eko", "eu")).toBe(say("5eko", "eu"));
        expect(normalizeBasque("995-ko")).toBe("995-ko"); // a bare ending still needs its vowel from speech
    });
});

describe("an (#1585)", () => {
    test("a figure that runs into a colon is a time, not a negative", () => {
        expect(say("-5:30", "an")).toBe(say("5:30", "an"));
        expect(normalizeAragonese("-5")).toBe("menos 5");
    });
    test("W after a degree is west, alongside U", () => {
        expect(say("20° W", "an")).toBe(say("20° U", "an"));
    });
});

describe("an, ast, oc: a time on the hour is the hour alone (#1585)", () => {
    test.each([
        ["an", normalizeAragonese],
        ["ast", normalizeAsturian],
        ["oc", normalizeOccitan],
    ] as const)("%s", (lang, normalize) => {
        expect(normalize("9:00")).toBe("9");
        expect(normalize("9:30")).toBe("9 30");
        expect(say("9:00", lang)).toBe(say("9", lang));
    });
});

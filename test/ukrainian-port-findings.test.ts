/**
 * Ukrainian defects the Rust port found (#1525), fixed TS-first. Probe text is synthetic; the expectations are
 * the fixed engine's output, checked against what each fix intends (docs/investigations/rust-port/
 * rust_uk_port_investigation.md, Run 7).
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { normalizeUkrainian } from "../src/languages/ukrainian/normalize.ts";

describe("Ukrainian port findings (#1525)", () => {
    test("1: a clock time before a full stop or a comma is read as a time", () => {
        expect(normalizeUkrainian("Це почалося о 6:30.")).toBe("Це почалося о шостій тридцять.");
        expect(normalizeUkrainian("о 6:30, потім")).toBe("о шостій тридцять, потім");
        expect(normalizeUkrainian("О 20:30 і з 6:30.")).toBe("О двадцятій тридцять і з шостої тридцять.");
        // A digit beyond the `.`/`,` is still a decimal or a dotted continuation, so the guard keeps it out.
        expect(normalizeUkrainian("о 6:30,5")).toBe("о 6:30,5");
        expect(normalizeUkrainian("о 6:30.5")).toBe("о 6:30,5");
    });

    test("2: an abbreviation dot before a capital also ends the sentence", () => {
        expect(normalizeUkrainian("1990 р. Потім")).toBe("1990 року. Потім");
        expect(normalizeUkrainian("та ін. Потім")).toBe("та інше. Потім");
        expect(normalizeUkrainian("1990 р. потім")).toBe("1990 року потім");
        // A preposed abbreviation's capital is its object, not a new sentence.
        expect(normalizeUkrainian("див. Петренко")).toBe("дивись Петренко");
        // The pause survives into the phonemes.
        expect(phonemize("1990 р. Потім", "uk")).toContain(" . ");
        expect(phonemize("1990 р. потім", "uk")).not.toContain(" . ");
    });

    test("3: a fraction's denominator takes the numerator's count", () => {
        expect(normalizeUkrainian("2/3")).toBe("дві третіх");
        expect(normalizeUkrainian("5/8")).toBe("п'ять восьмих");
        expect(normalizeUkrainian("22/5")).toBe("двадцять дві п'ятих");
        expect(normalizeUkrainian("11/5")).toBe("одинадцять п'ятих");
        expect(normalizeUkrainian("1/5")).toBe("одна п'ята");
        expect(normalizeUkrainian("21/100")).toBe("двадцять одна сота");
    });

    test("4: the abbreviation arm before `,;:` has the #1122 miss guard", () => {
        // U+1C81 / U+1C83 are Cyrillic Extended-C letters that the `iu` fold maps onto д / с.
        expect(normalizeUkrainian("ᲁив., далі")).toBe("ᲁив., далі");
        expect(normalizeUkrainian("Див. ᲃтор., далі")).toBe("дивись ᲃтор., далі");
        expect(normalizeUkrainian("Див. ᲃтор., далі")).not.toContain("undefined");
    });

    test("5: `constructor` before a clock time does not block it", () => {
        expect(normalizeUkrainian("Constructor 10:30")).toBe("Constructor десята тридцять");
        expect(normalizeUkrainian("toString 10:30")).toBe("toString десята тридцять");
    });

    test("6: clock minutes agree with the feminine хвилина", () => {
        expect(normalizeUkrainian("О 1:01")).toBe("О першій одна");
        expect(normalizeUkrainian("3:02")).toBe("третя дві");
        expect(normalizeUkrainian("о 20:21")).toBe("о двадцятій двадцять одна");
        expect(normalizeUkrainian("о 11:12")).toBe("о одинадцятій дванадцять"); // 12 is not a 2
    });
});

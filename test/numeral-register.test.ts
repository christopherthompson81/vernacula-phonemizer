/**
 * The per-language NUMERAL REGISTER (tools/corpus/numeral_register.mts).
 *
 * ⚠ THIS IS CORPUS POLICY AND MUST NOT REACH THE ENGINE. Wiring it into `src/registry.ts` was tried and
 * reverted: it overrode each language's own cardinal compositor and broke 31 gold tests encoding real work.
 * The last test here is the guard for that — `phonemize` must be untouched for a language that HAS a
 * register, or the separation has silently collapsed.
 */
import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { applyNumeralRegister, NUMERAL_REGISTER_LANGS } from "../tools/corpus/numeral_register.mts";

describe("numeral register (corpus rendering policy)", () => {
    test("only the measured languages are wired, by REGISTRY code", () => {
        // ⚠ FLEURS writes `ny_mw`; this registry ships Chichewa as `nya`. A key that is not a registered
        //   code is silently dead — it can never match — so the codes are pinned here.
        expect([...NUMERAL_REGISTER_LANGS].sort()).toEqual(["ln", "nya", "sn", "xh", "zu"]);
    });

    test("a wired language voices digits in its measured register", () => {
        expect(applyNumeralRegister("makore 480 apfuura", "sn")).toContain("four hundred eighty");
        expect(applyNumeralRegister("zaka 100 zapitazo", "nya")).toContain("one hundred");
        // ⚠ `ln` IS FRENCH, not English. It scores 66% for English against 89% for French, so wiring it to
        //   English by analogy with the other African languages would have applied the wrong language at a
        //   rate that still looked like an improvement.
        expect(applyNumeralRegister("na 1998", "ln")).toContain("mille neuf cent quatre-vingt-dix-huit");
        expect(applyNumeralRegister("na 1998", "ln")).not.toContain("thousand");
    });

    test("an unwired language is untouched, and that is on evidence", () => {
        // de/fr/bn/ckb/mt read their own numerals — fr scored 3 closer against 397 further — so this is an
        // opt-in table, never a default with exceptions.
        for (const l of ["fr", "de", "bn", "mt", "ckb", "en", "ceb", "mi"]) {
            expect(applyNumeralRegister("480 x", l)).toBe("480 x");
        }
    });

    test("grouped thousands are one number, not three fragments", () => {
        expect(applyNumeralRegister("783 562 km", "ln")).toContain("cinq cent soixante-deux");
        expect(applyNumeralRegister("3,980 x", "sn")).toContain("three thousand nine hundred eighty");
    });

    test("a decimal is left alone — it has its own reading in every language", () => {
        expect(applyNumeralRegister("versie 1.5", "sn")).toBe("versie 1.5");
    });

    test("text with no digits is returned unchanged", () => {
        expect(applyNumeralRegister("makore apfuura", "sn")).toBe("makore apfuura");
    });

    /**
     * ⚠ THE SEPARATION GUARD. `phonemize` is the engine; it must read a language's OWN numerals however the
     * corpus renders them. Chichewa's compositor encodes noun-class agreement (1 → t͡ʃimod͡zi, 42 →
     * makumi anaji ⁿdi ziwiɽi) and that is the language's fact, not this corpus's preference.
     */
    test("the engine is untouched for a language that has a register", () => {
        expect(phonemize("1", "nya")).toBe("t͡ʃimod͡zi");
        expect(phonemize("42", "nya")).toBe("makumi anaji ⁿdi ziwiɽi");
    });
});

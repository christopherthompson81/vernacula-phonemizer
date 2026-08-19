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
import { numeralSegments, NUMERAL_REGISTER_LANGS } from "../tools/corpus/numeral_register.mts";

/** Render segments the way the corpus tool does: each by the engine that owns it, IPA joined. */
const render = (text: string, code: string): string =>
    numeralSegments(text, code).map((s) => phonemize(s.text, s.lang ?? code)).filter(Boolean).join(" ")
        .replace(/\s+/gu, " ").trim();
/** The register's word output for a text, for asserting WHICH words were chosen. */
const words = (text: string, code: string): string =>
    numeralSegments(text, code).map((s) => s.text).join("|");

describe("numeral register (corpus rendering policy)", () => {
    /**
     * ⚠ ASSERTED AGAINST THE REGISTRY, NOT A HARDCODED LIST. Comparing the keys to a literal array cannot
     * catch the bug it exists for: renaming `nya` to `ny` in BOTH the table and the array keeps it green
     * while the entry goes silently dead, since `ny` is not a registered code. The first version of this
     * table shipped four such dead keys (`sna`, `zul`, `xho`, `ny`).
     */
    test("every wired key is a live registry code", () => {
        expect(NUMERAL_REGISTER_LANGS.length).toBe(5);
        for (const code of NUMERAL_REGISTER_LANGS) {
            expect(() => phonemize("test", code), `dead key: ${code}`).not.toThrow();
        }
    });

    test("a wired language voices digits in its measured register", () => {
        expect(words("makore 480 apfuura", "sn")).toContain("four hundred eighty");
        expect(words("zaka 100 zapitazo", "nya")).toContain("one hundred");
        // ⚠ `ln` IS FRENCH, not English. It scores 66% for English against 89% for French, so wiring it to
        //   English by analogy with the other African languages would have applied the wrong language at a
        //   rate that still looked like an improvement.
        expect(words("na 1998", "ln")).toContain("mille neuf cent quatre-vingt-dix-huit");
        expect(words("na 1998", "ln")).not.toContain("thousand");
    });

    test("an unwired language is untouched, and that is on evidence", () => {
        // de/fr/bn/ckb/mt read their own numerals — fr scored 3 closer against 397 further — so this is an
        // opt-in table, never a default with exceptions.
        for (const l of ["fr", "de", "bn", "mt", "ckb", "en", "ceb", "mi"]) {
            expect(words("480 x", l)).toBe("480 x");
        }
    });

    test("grouped thousands are one number, not three fragments", () => {
        expect(words("783 562 km", "ln")).toContain("cinq cent soixante-deux");
        expect(words("3,980 x", "sn")).toContain("three thousand nine hundred eighty");
    });

    /**
     * ⚠ THE SHAPES THE REGISTER WAS NOT MEASURED ON MUST BE DECLINED, and each of these is attested in the
     * five wired languages — they are not hypothetical corners. A cardinal compositor mangles all of them
     * silently, which is the failure mode that matters: the output is plausible and wrong.
     */
    test("unmeasured number shapes are declined", () => {
        // 42 rows. A EUROPEAN DECIMAL COMMA, not grouping — read as grouping, `1,5` comes out *fifteen*.
        expect(words("ezingu-1,5", "zu")).toBe("ezingu-1,5");
        expect(words("2,8", "sn")).toBe("2,8");
        // 109 rows. A clock time, not two cardinals.
        expect(words("dza10:08", "sn")).toBe("dza10:08");
        expect(words("11:20", "zu")).toBe("11:20");
        // 252 rows. A leading zero is an identifier or a grouped tail; `Number()` drops the zeros, so
        // `007` would read *seven*.
        expect(words("007", "sn")).toBe("007");
        expect(words("00", "sn")).toBe("00");
        // A decimal has its own reading in every language.
        expect(words("versie 1.5", "sn")).toBe("versie 1.5");
        // Past the compositors' range, hand back the digits rather than a truncated reading.
        expect(words("9007199254740993", "sn")).toBe("9007199254740993");
    });

    test("text with no digits is returned unchanged", () => {
        expect(words("makore apfuura", "sn")).toBe("makore apfuura");
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

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

    /**
     * ⚠ A YEAR IS NOT ITS CARDINAL. The register emitted *one thousand nine hundred ninety eight* for 1998
     * where an English-register reader says *nineteen ninety-eight* — 681 rows, 600 of which moved closer to
     * the audio once fixed. The engine's own year rule cannot fire here: it is gated on an English context
     * word and the context around a digit run in a Zulu sentence is Zulu.
     */
    test("an English-register year reads pair-wise, not as a cardinal", () => {
        // Emitted as the digit-pair tokens `src/languages/english/normalize.ts` uses, so the English number
        // path composes the words rather than this module.
        expect(words("ngo-1998", "zu")).toContain("19 98");
        expect(render("ngo-1998", "zu")).toContain("nˈaᶦntˈiːn");     // nineteen
        expect(render("ngo-1998", "zu")).not.toContain("θˈaᶷzənd");   // …not "thousand"
        // The four irregular shapes of the pair-wise reading.
        expect(words("mu 1905", "nya")).toContain("19 oh 5");
        expect(words("mu 1900", "nya")).toContain("19 hundred");
        expect(words("mu 2007", "nya")).toContain("2 thousand 7");
        expect(words("mu 2011", "nya")).toContain("20 11");
    });

    /**
     * ⚠ THE RANGE AND UNIT GUARDS ARE THE ENGLISH NORMALIZER'S. Outside 1100–2099 a 4-digit number is a
     * quantity, and so is one carrying a unit: the corpus's `1600 km` trail is *one thousand six hundred
     * kilometres*, not *sixteen hundred*.
     */
    test("a quantity that merely looks like a year is not read as one", () => {
        expect(words("1600 km", "xh")).toContain("one thousand six hundred");
        expect(words("we-1600 km", "xh")).toContain("one thousand six hundred");
        expect(words("zaka 1000", "nya")).toContain("one thousand");   // 26 rows; not the year 1000
        expect(words("2500 x", "sn")).toContain("two thousand five hundred");
        // ⚠ `ln` IS FRENCH AND MUST NOT ACQUIRE A YEAR RULE. French reads a year as its cardinal
        //   — *mil neuf cent quatre-vingt-dix-huit* — which is what the register already emitted.
        expect(words("na 1998", "ln")).toContain("mille neuf cent quatre-vingt-dix-huit");
    });

    /**
     * ⚠ A GROUPED NUMBER USES ONE SEPARATOR THROUGHOUT. With `,` and the spaces interchangeable within a
     * single run, two 6-digit figures sitting side by side in a table matched as ONE 12-digit number.
     */
    test("two grouped numbers side by side stay two numbers", () => {
        const w = words("783,562 300,948 x", "nya");
        expect(w).toContain("seven hundred eighty three thousand five hundred sixty two");
        expect(w).toContain("three hundred thousand nine hundred forty eight");
        expect(w).not.toContain("billion");
        // …while genuine space grouping, which is how `ln` writes its thousands, still joins.
        expect(words("104 500 ya", "ln")).toContain("cent quatre mille cinq cents");
    });

    /**
     * ⚠ SENTENCE PUNCTUATION IS NOT A DECIMAL POINT. Refusing any run that touched `.` or `,` also refused
     * every run at the end of a clause — 28 rows of ordinary cardinals, 31 of the 33 affected moving closer
     * to the audio once read. Only `.`/`,` FOLLOWED BY A DIGIT is a decimal.
     */
    test("a run at the end of a clause is read, not declined", () => {
        expect(words("na 1992.", "ln")).toContain("mille neuf cent quatre-vingt-douze");
        expect(words("mu 1998, ndipo", "nya")).toContain("19 98");
        expect(words("kv62. kv62", "sn")).toContain("sixty two");
        // …and the decimal readings this lookahead exists for are still refused.
        expect(words("ezingu-1,5", "zu")).toBe("ezingu-1,5");
        expect(words("versie 1.5", "sn")).toBe("versie 1.5");
        expect(words("11:20", "zu")).toBe("11:20");
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

/**
 * #1593: the xh/st/tn/sn defects the Rust port of the southern Bantu group found. All inputs are synthetic, and
 * every assertion is relational, so no IPA is typed. Mirrored in C# (`SBantuDefects1593Tests.cs`) and in Rust
 * (each language's own module). The zu long-ſ item is covered fleet-wide by #1601.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";

describe("xh", () => {
    test("± is read, not dropped", () => {
        expect(phonemize("Ubushushu bu-±5 apha", "xh")).toBe(phonemize("Ubushushu bu- plas o mayinas 5 apha", "xh"));
        expect(phonemize("±5", "xh")).not.toBe(phonemize("5", "xh"));
    });
});

describe("st", () => {
    test("a road number after R is not money", () => {
        const rand = phonemize("diranta", "st");
        expect(phonemize("Tsela ya R59 le N12 e kgolo", "st")).not.toContain(rand);
        expect(phonemize("ka R59.", "st")).not.toContain(rand);
    });

    test("a rand amount still reads as money", () => {
        const rand = phonemize("diranta", "st");
        for (const t of ["ka R30,000,000", "ka R8 million", "ka R332 milione", "ka R2.3m", "ka R3,2 milione"]) {
            expect(phonemize(t, "st"), t).toContain(rand);
        }
    });

    test("a bare bn magnitude reads as its word", () => {
        expect(phonemize("Ho ne ho le 1.5bn", "st")).toBe(phonemize("Ho ne ho le dibilione tse 1.5", "st"));
        expect(phonemize("ka 915 m", "st")).toBe(phonemize("ka dimithara tse 915", "st"));
    });
});

describe("tn", () => {
    test("a bare bn magnitude reads as its word", () => {
        expect(phonemize("Go ne go le 1.5bn", "tn")).toBe(phonemize("Go ne go le 1.5 dibilione", "tn"));
    });
});

describe("sn", () => {
    test("a bn magnitude reads as its word, with or without a currency sign", () => {
        expect(phonemize("Ne 1.5bn zvakare", "sn")).toBe(phonemize("Ne 1.5 bhiriyoni zvakare", "sn"));
        expect(phonemize("Ne $1.5bn zvakare", "sn")).toBe(phonemize("Ne $1.5 bhiriyoni zvakare", "sn"));
    });
});

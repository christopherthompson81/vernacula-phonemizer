/**
 * #1587: te, ta, si and kn defects found by the Rust port of the Dravidian group. Relational throughout, so no IPA is
 * typed. All inputs are synthetic. Mirrored in C# (`DravidianSiDefects1587Tests.cs`) and in each language's Rust
 * module.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";

const words = (s: string): string[] => s.trim().split(/\s+/u);

describe("te: a number with a currency or percent sign is not a year", () => {
    test("the sign's word survives in the 1100-1999 band, as it does outside it", () => {
        for (const [band, outside] of [["$1500", "$2500"], ["US$1500", "US$2500"], ["1500 $", "2500 $"], ["1500%", "2500%"]]) {
            expect(words(phonemize(band!, "te")).at(-1), band).toBe(words(phonemize(outside!, "te")).at(-1));
        }
    });

    test("an amount is read as a cardinal, and a bare numeral in the band is still a year", () => {
        const amount = words(phonemize("$1500", "te")).slice(0, -1).join(" ");
        expect(amount).not.toBe(phonemize("1500", "te").trim());
        expect(phonemize("1976", "te")).not.toBe(phonemize("$1976", "te"));
    });
});

describe("ta: an ordinal on an unsafe integer reads the written digits", () => {
    test("the reading begins with the bare numeral's, past 2^53 and past 10^21", () => {
        for (const digits of ["12345678901234567891", "1234567890123456789012"]) {
            expect(phonemize(`${digits}ஆம்`, "ta").startsWith(phonemize(digits, "ta").trim()), digits).toBe(true);
        }
    });

    test("a safe ordinal still fuses its suffix", () => {
        expect(phonemize("15ஆம்", "ta").startsWith(phonemize("15", "ta").trim())).toBe(false);
    });
});

describe("si: an unsafe integer is read one digit at a time", () => {
    test("neighbours above 2^53 no longer read alike", () => {
        expect(phonemize("9007199254740993", "si")).not.toBe(phonemize("9007199254740992", "si"));
    });

    test("10^23 reads its written digits", () => {
        const digits = "100000000000000000000000";
        const spelled = [...digits].map((d) => phonemize(d, "si").trim()).join(" ");
        expect(phonemize(digits, "si").trim()).toBe(spelled);
    });

    test("the largest safe integer still composes", () => {
        const digits = "9007199254740991";
        const spelled = [...digits].map((d) => phonemize(d, "si").trim()).join(" ");
        expect(phonemize(digits, "si").trim()).not.toBe(spelled);
    });
});

describe("kn: the dotted unit and the bare fraction", () => {
    test("a dotted unit mid-sentence leaves no pause", () => {
        expect(phonemize("10 ಕಿ.ಮೀ. ದೂರ", "kn")).toBe(phonemize("10 ಕಿಲೋಮೀಟರ್ ದೂರ", "kn"));
    });

    test("a sentence-final dotted unit keeps its full stop, and an undotted unit's dot is a full stop", () => {
        expect(phonemize("ದೂರ 10 ಕಿ.ಮೀ.", "kn")).toBe(phonemize("ದೂರ 10 ಕಿಲೋಮೀಟರ್.", "kn"));
        expect(phonemize("10 ಕಿಮೀ. ದೂರ", "kn")).toBe(phonemize("10 ಕಿಲೋಮೀಟರ್. ದೂರ", "kn"));
    });

    test("a bare vulgar fraction reads as its word", () => {
        expect(phonemize("½ ಭಾಗ", "kn")).toBe(phonemize("ಅರ್ಧ ಭಾಗ", "kn"));
        expect(phonemize("¼ ಭಾಗ", "kn")).toBe(phonemize("ಕಾಲು ಭಾಗ", "kn"));
        expect(phonemize("¾ ಭಾಗ", "kn")).toBe(phonemize("ಮುಕ್ಕಾಲು ಭಾಗ", "kn"));
    });
});

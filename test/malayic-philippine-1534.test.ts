import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { normalizeMalay } from "../src/languages/malay/normalize.ts";
import { numberWords } from "../src/languages/tagalog/tagalog.ts";
import { phonemizeWordRules as iloRules } from "../src/languages/ilocano/ilocano.ts";
import { phonemizeWord as hilWord } from "../src/languages/hiligaynon/hiligaynon.ts";

// #1534: defects the Rust port found in id, ms, tl, ceb, hil and ilo. Expectations are RELATIONAL (an input reads
// as a spelling the engine already reads correctly) or structural — never typed IPA. Probe text is synthetic.
const say = (s: string, l: string): string => phonemize(s, l);

describe("id #1534", () => {
    test.each([
        ["1.000,5", "1000,5"],
        ["Rp 1.000,50", "Rp 1000,50"],
        ["1.000.000,25 orang", "1000000,25 orang"],
        ["1.000, dan", "1000, dan"],
    ])("a grouped amount keeps its decimal comma: %s reads as %s", (a, b) => {
        expect(say(a, "id")).toBe(say(b, "id"));
    });
    test("an unmarked colon pair is two numbers, not a clock", () => {
        expect(say("skor 21:20", "id")).toBe(say("skor 21, 20", "id"));
        expect(say("skor 21:20", "id")).not.toContain("lewˈat");
    });
    test.each([["pukul 21:20"], ["Pukul 9:30"], ["jam 9:30 pagi"], ["21:20 WIB"], ["pukul 8.46"], ["8.46"]])(
        "a marked colon clock, and every dot clock, still reads lewat: %s", (t) => {
            expect(say(t, "id")).toContain("lewˈat");
        });
});

describe("ms #1534", () => {
    test("US before an amount folds to the bare sign; AS keeps its code", () => {
        expect(say("yuran US$30", "ms")).toBe(say("yuran $30", "ms"));
        expect(say("yuran US $30", "ms")).toBe(say("yuran $30", "ms"));
        expect(normalizeMalay("yuran AS$30")).toBe("yuran AS $30");
    });
    test("a run with two grouping dots is a grouped number, not a decimal", () => {
        expect(say("12.345.678 orang", "ms")).toBe(say("12345678 orang", "ms"));
        expect(say("3.141", "ms")).toContain("pərpulˈuhan");
    });
});

describe("tl #1534", () => {
    test("an ika- ordinal above 2^53 reads its digits and never throws", () => {
        const long = say(`ika-${"9".repeat(400)}`, "tl");
        expect(long.split(" ")).toHaveLength(400);
        const a = say("ika-12345678901234567891", "tl");
        expect(a).not.toBe(say("ika-12345678901234567899", "tl"));
        expect(a.split(" ").slice(1)).toEqual(say("12345678901234567891", "tl").split(" ").slice(1));
    });
    test("the cardinal has scales above milyon", () => {
        expect(numberWords(2e9)).toBe(`${numberWords(2).replace(/$/u, "ng")} bilyon`);
        expect(numberWords(3e12).endsWith(" trilyon")).toBe(true);
        expect(numberWords(1e9)).not.toContain("milyon");
        expect(numberWords(999999999).split(" ")).toContain("milyon");
    });
});

describe("ceb/hil/ilo #1534: three or more fraction digits", () => {
    test.each([["ceb", "ka"], ["ilo", "a"]])("%s reads 3.141 as a decimal", (l, ka) => {
        expect(say(`3.141 ${ka} metro`, l)).toBe(say(`3 punto 1 4 1 ${ka} metro`, l));
    });
    test.each([["0.625", "0 punto 6 2 5"], ["3.1416", "3 punto 1 4 1 6"], ["1234.567", "1234 punto 5 6 7"]])(
        "hil reads %s as a decimal (a thousands group cannot have this shape)", (a, b) => {
            expect(say(a, "hil")).toBe(say(b, "hil"));
        });
    test("hil still refuses the ambiguous d.ddd shape its corpus writes as period-thousands", () => {
        expect(say("17.865 ka pumuluyo", "hil")).not.toContain("pˈunto");
    });
});

describe("ceb #1534: the meridiem after a clock", () => {
    test.each([
        ["12.30 pm", "12.30 sa hapon"],
        ["8.15 p.m. ug", "8.15 sa gabii ug"],
        ["8.15 P.M. ug", "8.15 sa gabii ug"],
        ["8.15 a.m. ug", "8.15 sa buntag ug"],
        ["alas 9:30 pm", "alas 9:30 sa gabii"],
    ])("%s reads as %s", (a, b) => {
        expect(say(a, "ceb")).toBe(say(b, "ceb"));
    });
});

describe("hil/ilo #1534: a trigraph's vowel is a nucleus", () => {
    test.each([["queso", "keso"], ["quinse", "kinse"], ["Quezon", "Keson"]])("hil %s stresses like %s", (a, b) => {
        expect(hilWord(a)).toBe(hilWord(b));
    });
    test.each([["queso", "keso"], ["Quezon", "Keson"]])("ilo %s stresses the same syllable as %s", (a, b) => {
        const at = (s: string): number => s.indexOf("ˈ");
        expect(at(iloRules(a))).toBe(at(iloRules(b)));
    });
});

describe("ilo #1534: a compass letter after the degree sign", () => {
    test.each([["45° N", "45 grado amianan"], ["45°S ken", "45 grado abagatan ken"], ["12° E", "12 grado daya"],
        ["12°W", "12 grado laud"]])("%s reads as %s", (a, b) => {
        expect(say(a, "ilo")).toBe(say(b, "ilo"));
    });
});

/**
 * HINDI'S SUPPLETIVE ORDINAL SPELLINGS — `1ला`, `2रा`, `4था`, `6ठा`, which are ordinary Hindi orthography
 * and which the ordinal rule never reached.
 *
 * ⚠ THE WORDS WERE ALREADY THERE. `irregularOrdinals` has held पहला/दूसरा/तीसरा/चौथा/छठा all along, and
 * `1वाँ` read correctly the whole time — only the REGULAR suffixes were in the trigger, so `1ला` fell
 * through to the cardinal and left its suffix stranded as a syllable: *ˈeːk lˈaː*, "one laa". That is
 * exactly the failure step 2's own comment says the rule exists to prevent.
 *
 * ⚠ AND THE OBVIOUS FIX WOULD HAVE BEEN WORSE THAN THE BUG. `था` is the masculine past copula and `थी` the
 * feminine, so a rule matching `\d\s?(ला|रा|था|ठा)` would read `2 था` — "there were 2" — as an ordinal.
 * Three guards, and the middle one is the load-bearing one:
 *   · GLUED, never `\s?` — a copula is always its own word, which is what gluing tests;
 *   · the consonant must be THAT NUMBER's own, declared per number, so `2था` cannot match on 4's;
 *   · the trailing letter-boundary, so `2राज्य` ("2 states") is not claimed as `2रा` + ज्य.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { MANIFEST as HI } from "../src/languages/hindi/manifest.ts";

const hi = (s: string): string => phonemize(s, "hi").replace(/[ˈˌ]/gu, "");
const ORD = (HI as unknown as { irregularOrdinals: Record<string, string[]> }).irregularOrdinals;

describe("the suppletive spellings now reach the table", () => {
    test.each([["1ला", "1", 0], ["2रा", "2", 0], ["3रा", "3", 0], ["4था", "4", 0], ["6ठा", "6", 0],
               ["1ली", "1", 1], ["2री", "2", 1], ["4थी", "4", 1]] as const)(
        "%s reads the declared suppletive form", (written, n, form) => {
            expect(hi(`${written} बार`)).toBe(hi(`${ORD[n]![form]!} बार`));
        });

    test("and it agrees with the REGULAR spelling of the same ordinal", () => {
        // `1ला` and `1वाँ` are two ways to write "first"; both must land on पहला.
        expect(hi("1ला स्थान")).toBe(hi("1वाँ स्थान"));
    });

    test("a Devanagari numeral works too — digits are folded before this rule", () => {
        expect(hi("४था है")).toBe(hi("चौथा है"));
    });
});

describe("the guards — each one refuses a shape that would otherwise be misread", () => {
    test("⚠ THE PAST COPULA IS NOT AN ORDINAL: `2 था` is \"there were 2\"", () => {
        expect(hi("2 था")).toBe(hi("दो था"));
        expect(hi("4 था")).toBe(hi("चार था"));
        // and the feminine copula likewise
        expect(hi("2 थी")).toBe(hi("दो थी"));
    });

    test("a word that merely STARTS with the suffix is not claimed", () => {
        // ⚠ The claim is that the ORDINAL rule declines, not that spacing is preserved — the tokenizer
        // separates the digit from the word either way, which an equality against `दो राज्य` would conflate.
        expect(hi("2राज्य")).not.toContain(hi("दूसरा"));
        expect(hi("2राज्य")).toContain(hi("दो"));
        expect(hi("10 लाख")).toBe(hi("दस लाख"));
    });

    test("the consonant must be that number's own — `2था` is not \"second\"", () => {
        expect(hi("2था")).not.toBe(hi("दूसरा"));
    });

    test("the regular arm is untouched", () => {
        expect(hi("16वीं सदी")).toBe(hi("सोलहवीं सदी"));
        expect(hi("190 वें स्थान")).not.toBe(hi("190 स्थान"));
    });
});

/**
 * ⚠ THE TABLES ARE HINDI'S AND SERVE THE WHOLE FAMILY. That is inherited — the ordinal data used to be a
 * literal in `hindi/normalize.ts`, so awa/bho/mag/hne/mai have always read Hindi's ordinal words through
 * the regular arm. The suppletive arm inherits the same default, and the normalizer now takes the
 * language's own def so a family member that sources its own forms overrides it in one line.
 */
describe("the family inherits Hindi's tables, and that is now explicit", () => {
    test("awadhi's corpus instance `४था` reads as an ordinal, not a stranded syllable", () => {
        const awa = (s: string): string => phonemize(s, "awa").replace(/[ˈˌ]/gu, "");
        expect(awa("४था है")).not.toBe(awa("४ था है"));
        expect(awa("४था है").split(" ")).toHaveLength(2);
    });

    test("a family member declaring no ordinal data still gets the default, not a broken rule", () => {
        // bho declares none; the regular arm must keep working rather than compiling an empty alternation.
        const bho = (s: string): string => phonemize(s, "bho").replace(/[ˈˌ]/gu, "");
        expect(bho("16वीं सदी")).not.toBe(bho("16 सदी"));
    });
});

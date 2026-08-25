/**
 * Ukrainian's word tables come from ukrainian.jsonc. These assertions are derived FROM the manifest, so what
 * they catch is DECOUPLING — a literal re-hardcoded in the code — rather than wrong data.
 *
 * ⚠ THREE THINGS HERE LOOK LIKE DUPLICATES AND ARE NOT:
 *  · `ordinals` is MASCULINE and `romanOrdinals` is NEUTER. The century noun (століття) is neuter, unlike
 *    Russian's and Polish's, so the Roman reading needs its own table; merging them would say *двадцятий
 *    століття*.
 *  · `ordinals` and `genitiveCardinals` both answer the digits-hyphen-letters shape, and which one is right
 *    depends on the suffix: `1970-х` is an ordinal, `3-х` an oblique cardinal.
 *  · `romanOrdinals.context` omits вік ON PURPOSE — a masculine context read from a neuter table would be
 *    wrong, so `XX вік` is left as a cardinal.
 *
 * ⚠ AND TWO THINGS THAT WERE GENUINE DUPLICATES, which is what the lift found: normalize.ts held its own
 * copies of the metre forms and the squared adjective, byte-identical to the symbol tier's own `units.м` and
 * `exponentWords.squared`, with nothing keeping them together.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { MANIFEST } from "../src/languages/ukrainian/manifest.ts";

/** IPA with the stress marks stripped — Ukrainian marks none, but the shared helpers may. */
const say = (s: string): string => phonemize(s, "uk").replace(/[ˈˌ]/gu, "");

describe("ukrainian reads its lifted tables", () => {
    test("the metre and the squared adjective have ONE source, shared with the symbol tier", () => {
        // The rule in normalize.ts (`6 м`, apostrophe-aware) and the shared tier (`6 км`) must answer with
        // words from the same entry. If either re-hardcodes its own copy this still passes on equal data —
        // so the assertion that matters is the one below it: the reading must follow the manifest.
        expect(MANIFEST.symbolTier.units["м"]).toEqual(["метр", "метри", "метрів", "метра"]);
        expect(say("6 м завширшки")).toContain(say(MANIFEST.symbolTier.units["м"]![2]!));
        expect(say("1 м завширшки")).toContain(say(MANIFEST.symbolTier.units["м"]![0]!));
        // `кв. миль` takes the gen.pl of the SAME adjective the exponent seam uses for км².
        expect(say("9 кв. миль")).toContain(say(MANIFEST.symbolTier.exponentWords.squared[2]!));
        expect(say("9 км²")).toContain(say(MANIFEST.symbolTier.exponentWords.squared[2]!));
    });

    test("the masculine and neuter ordinal tables are both live and are different words", () => {
        expect(MANIFEST.ordinals.oneToNineteen[19]).not.toBe(MANIFEST.romanOrdinals.oneToNineteen[19]);
        expect(say("19-й день")).toContain(say(MANIFEST.ordinals.oneToNineteen[19]!));
        expect(say("XIX століття")).toContain(say(MANIFEST.romanOrdinals.oneToNineteen[19]!));
    });

    test("вік is absent from the Roman context, so a masculine noun keeps the cardinal", () => {
        expect(MANIFEST.romanOrdinals.context).not.toContain("вік");
        expect(say("XX вік")).not.toContain(say(MANIFEST.romanOrdinals.tens[2]!));
    });

    test("the oblique cardinal and the ordinal answer the same written shape differently", () => {
        expect(say("3-х осіб")).toContain(say(MANIFEST.genitiveCardinals.oneToNineteen[3]!));
        expect(say("1970-х років")).toContain("sʲimdɛsʲatɪx"); // сімдесятих — the decade ORDINAL
    });

    test("the clock selects an ending BY CASE NAME, not by a magic index", () => {
        const endings = MANIFEST.ordinals.endings.map((e) => e.case);
        for (const c of Object.values(MANIFEST.clock.prepositionCase)) expect(endings).toContain(c);
        expect(endings).toContain(MANIFEST.clock.defaultCase);
        // ⚠ THE PREPOSITION MUST BE DROPPED BEFORE COMPARING. It is spoken too, so `say("о 20:30")` and
        // `say("з 20:30")` differ on their FIRST word no matter what the clock rule does — an assertion on
        // the whole string passes with every preposition wired to one hardcoded ending, which is exactly the
        // regression this test exists to catch. Verified by making that edit and watching it still pass.
        const hour = (prep: string): string => say(`${prep} 20:30`).split(" ").slice(1).join(" ");
        const forms = new Set([hour("о"), hour("з"), hour("між")]);
        expect(forms.size).toBe(3);
        // …and none of the three is the unprepositioned default.
        for (const f of forms) expect(f).not.toBe(say("20:30"));
    });

    test("the sign words are one source, shared with the symbol tier", () => {
        expect(say("4 = 4")).toContain(say(MANIFEST.signWords.equals));
        expect(say("±5")).toContain(say(MANIFEST.signWords.plusMinus));
        // ⟨×⟩ goes through the tier and ⟨x⟩ through normalize — one word for both.
        expect(say("4 × 4")).toContain(say(MANIFEST.signWords.times));
        expect(say("B&B")).toContain(say(MANIFEST.signWords.ampersand));
    });

    test("the multi-dot abbreviations are ordered longest-first", () => {
        const written = MANIFEST.multiDotAbbrev.map((a) => a.written);
        expect(written.indexOf("до н. е.")).toBeLessThan(written.indexOf("н. е."));
        expect(say("1100 року до н. е.")).toContain(say("до нашої ери"));
        // Both spacings occur in the corpus and the reconstructed pattern must claim both.
        expect(say("1100 року н.е.")).toBe(say("1100 року н. е."));
    });

    test("the fraction numerator feminises through numbers.feminine, not a fourth copy", () => {
        // The same pair the magnitude compositor uses for the feminine тисяча — and the masculine forms it
        // replaces are `units[1]` and `[2]`. The rule held its own copies of all four before the lift.
        expect(say("1/2 склянки")).toContain(say(MANIFEST.numbers.feminine.one));
        expect(say("1/2 склянки")).not.toContain(say(MANIFEST.numbers.units[1]!));
        expect(say("2/3 населення")).toContain(say(MANIFEST.numbers.feminine.two));
    });

    test("every other lifted table is reached by some reading", () => {
        expect(say("№11")).toContain(say(MANIFEST.numberSign));
        expect(say("1418-1450")).toContain(say(MANIFEST.rangeWord));
        expect(say("1 °C")).toContain(say(MANIFEST.temperatureScales["C"]!));
        expect(say("32 °F")).toContain(say(MANIFEST.temperatureScales["F"]!));
        expect(say("45°")).toContain(say(MANIFEST.degree[2]!));
        expect(say("стор. 45")).toContain(say(MANIFEST.dottedAbbrev["стор"]!));
        expect(say("10 м/с")).toContain(say(MANIFEST.symbolTier.rateDenominators["с"]!));
        expect(say("АОЛ")).toContain(say(MANIFEST.letterNames["а"]!));
        expect(MANIFEST.phonotactics.onsets).toContain("ст");
        expect(MANIFEST.phonotactics.codas).toContain("рк");
    });
});
